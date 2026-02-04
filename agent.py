import json
import math
import config
from database import log_event, record_decision

try:
    import anthropic
    HAS_ANTHROPIC = True
except ImportError:
    HAS_ANTHROPIC = False


class MarketAgent:
    def __init__(self):
        # Anthropic client is only needed for chat, not trading decisions
        self.client = None
        if HAS_ANTHROPIC and config.ANTHROPIC_API_KEY:
            self.client = anthropic.AsyncAnthropic(
                api_key=config.ANTHROPIC_API_KEY,
                timeout=60.0,
            )
        self.last_decision: dict | None = None

    # ------------------------------------------------------------------
    # Rule-based trading decision (replaces Claude API call)
    # ------------------------------------------------------------------

    def analyze_market(
        self, market_data: dict, current_position: dict | None = None,
        alpha_monitor=None,
    ) -> dict:
        """Rule-based trading decision using price history, volatility, and fair value.

        Evaluates 4 signal dimensions:
        1. Edge — is the contract mispriced vs fair value?
        2. Trend — is BTC price moving toward or away from strike?
        3. Volatility — high vol = trend-follow, low vol = sit out
        4. Time decay — conservative near expiry, aggressive with time

        Returns dict with keys: decision, confidence, reasoning.
        """
        strike = market_data.get("strike_price", 0)
        secs_left = market_data.get("seconds_to_close", 0)
        best_bid = market_data.get("best_bid", 0)
        best_ask = market_data.get("best_ask", 100)

        if not alpha_monitor or not strike or strike <= 0:
            return self._hold("No strike price or alpha data available")

        # 1. Fair value estimation
        fv = alpha_monitor.get_fair_value(strike, secs_left)
        fair_yes_cents = fv["fair_yes_cents"]
        fair_yes_prob = fv["fair_yes_prob"]
        btc_vs_strike = fv["btc_vs_strike"]

        # 2. Volatility regime
        vol = alpha_monitor.get_volatility()
        regime = vol["regime"]

        # 3. Price velocity / trend
        velocity = alpha_monitor.get_price_velocity()
        vel_1m = velocity["velocity_1m"]
        dir_1m = velocity["direction_1m"]
        change_1m = velocity["price_change_1m"]

        # 4. Time decay factor — directional boost for winning side near expiry
        # When BTC is far from strike and time is running out, the winning side
        # should get MORE confident (time decay working in their favor), not less.
        max_contract_secs = 900.0
        raw_time_factor = min(1.0, max(0.0, secs_left / max_contract_secs))

        # How many "expected moves" is BTC from strike?
        # Use reasonable floor for vol to avoid division issues when data is sparse
        vol_dpm = vol["vol_dollar_per_min"] if vol["vol_dollar_per_min"] >= 50 else 200
        expected_move = vol_dpm * math.sqrt(max(secs_left, 1) / 60)
        distance_ratio = min(10.0, abs(btc_vs_strike) / max(expected_move, 50))

        # Compute directional time factors (aggressive settings)
        if distance_ratio > 1.5:
            # Outcome is near-certain — strong boost to winning side
            winning_boost = 1.0 + (1.0 - raw_time_factor) * 0.75  # up to 1.75x near expiry
            losing_factor = raw_time_factor * 0.3  # heavily penalize losing side
        elif distance_ratio > 1.0:
            # Likely outcome — moderate boost to winner
            winning_boost = 1.0 + (1.0 - raw_time_factor) * 0.4  # up to 1.4x near expiry
            losing_factor = raw_time_factor * 0.6
        else:
            # Too close to strike — both sides stay conservative
            winning_boost = raw_time_factor
            losing_factor = raw_time_factor

        # Assign based on which side is winning
        if btc_vs_strike > 0:  # BTC above strike — YES is winning
            yes_time_factor = winning_boost
            no_time_factor = losing_factor
        else:  # BTC below strike — NO is winning
            yes_time_factor = losing_factor
            no_time_factor = winning_boost

        # Build reasoning trace
        reasons = []
        reasons.append(f"BTC {'above' if btc_vs_strike > 0 else 'below'} strike by ${abs(btc_vs_strike):.0f}")
        reasons.append(f"Fair: {fair_yes_cents}c YES ({fair_yes_prob:.0%})")
        reasons.append(f"Vol: {regime} (${vol['vol_dollar_per_min']:.1f}/min)")
        reasons.append(f"Trend: ${change_1m:+.0f}/1m")
        reasons.append(f"Time: {secs_left:.0f}s left (dist={distance_ratio:.1f}x, Y×{yes_time_factor:.2f}/N×{no_time_factor:.2f})")

        # Low-vol sit-out
        if config.RULE_SIT_OUT_LOW_VOL and regime == "low":
            return self._hold(f"Low vol — sitting out. {'; '.join(reasons)}")

        # Compute edge on each side
        yes_cost = best_ask
        no_cost = 100 - best_bid
        yes_edge = fair_yes_cents - yes_cost
        no_edge = (100 - fair_yes_cents) - no_cost

        reasons.append(f"YES edge: {yes_edge:+d}c (fair {fair_yes_cents} vs ask {yes_cost})")
        reasons.append(f"NO edge: {no_edge:+d}c (fair {100 - fair_yes_cents} vs cost {no_cost})")

        min_edge = config.MIN_EDGE_CENTS

        # Trend confirmation
        trend_confirms_yes = dir_1m > 0
        trend_confirms_no = dir_1m < 0

        # High vol: relax edge, add trend bonus
        if regime == "high":
            min_edge = max(3, min_edge - 3)

        # Score YES — edge/100 spreads confidence over a wider range
        yes_score = 0.0
        if yes_edge >= min_edge:
            yes_score = yes_edge / 100.0
            if trend_confirms_yes:
                yes_score += 0.10
                if regime == "high" and abs(vel_1m) > config.TREND_FOLLOW_VELOCITY:
                    yes_score += 0.05
            yes_score *= yes_time_factor

        # Score NO
        no_score = 0.0
        if no_edge >= min_edge:
            no_score = no_edge / 100.0
            if trend_confirms_no:
                no_score += 0.10
                if regime == "high" and abs(vel_1m) > config.TREND_FOLLOW_VELOCITY:
                    no_score += 0.05
            no_score *= no_time_factor

        # Pick the best side
        decision = "HOLD"
        confidence = 0.0

        # Calculate potential confidence for both sides (even if no edge)
        potential_yes_conf = min(0.95, 0.45 + max(0, yes_edge / 100.0) * yes_time_factor) if yes_edge > 0 else 0.0
        potential_no_conf = min(0.95, 0.45 + max(0, no_edge / 100.0) * no_time_factor) if no_edge > 0 else 0.0
        best_potential = max(potential_yes_conf, potential_no_conf)

        if yes_score > no_score and yes_score > 0:
            decision = "BUY_YES"
            confidence = min(0.95, 0.45 + yes_score)
            reasons.append(f"-> BUY YES (score {yes_score:.2f}, edge {yes_edge}c"
                           + (", trend OK" if trend_confirms_yes else "") + ")")
        elif no_score > yes_score and no_score > 0:
            decision = "BUY_NO"
            confidence = min(0.95, 0.45 + no_score)
            reasons.append(f"-> BUY NO (score {no_score:.2f}, edge {no_edge}c"
                           + (", trend OK" if trend_confirms_no else "") + ")")
        else:
            # No edge - show what confidence would be if there was edge
            return self._hold(f"No edge. {'; '.join(reasons)}", confidence=best_potential)

        # Confidence gate
        if confidence < config.RULE_MIN_CONFIDENCE:
            return self._hold(f"Low confidence {confidence:.0%}. {'; '.join(reasons)}", confidence=confidence)

        reasoning = "; ".join(reasons)
        self.last_decision = {
            "decision": decision,
            "confidence": confidence,
            "reasoning": reasoning,
        }

        record_decision(
            market_id=market_data.get("ticker"),
            decision=decision,
            confidence=confidence,
            reasoning=reasoning,
        )
        log_event("RULES", f"{decision} ({confidence:.0%}) — {reasoning[:200]}")
        return self.last_decision

    def _hold(self, reasoning: str, confidence: float = 0.0) -> dict:
        """Return a HOLD decision with optional confidence score."""
        result = {"decision": "HOLD", "confidence": confidence, "reasoning": reasoning}
        self.last_decision = result
        log_event("RULES", f"HOLD — {reasoning[:200]}")
        return result

    # ------------------------------------------------------------------
    # Chat (still uses Anthropic API)
    # ------------------------------------------------------------------

    async def chat(self, user_message: str, bot_status: dict | None = None,
                   trades_summary: dict | None = None, config: dict | None = None,
                   history: list[dict] | None = None,
                   config_updater: callable = None) -> str:
        """Free-form chat with the agent about markets / strategy."""
        if not self.client:
            return "Chat requires ANTHROPIC_API_KEY to be set."

        # Build rich context from live data
        context_parts = []

        if bot_status:
            # Extract key metrics for context
            dashboard = bot_status.get("dashboard", {})
            ctx = {
                "running": bot_status.get("running"),
                "balance": bot_status.get("balance"),
                "position": bot_status.get("position"),
                "market": bot_status.get("market"),
                "last_action": bot_status.get("last_action"),
                "decision": bot_status.get("decision"),
                "confidence": bot_status.get("confidence"),
                "reasoning": bot_status.get("reasoning"),
            }
            # Dashboard alpha signals
            if dashboard:
                ctx["btc_price"] = dashboard.get("btc_price")
                ctx["strike"] = dashboard.get("strike")
                ctx["volatility"] = dashboard.get("volatility")
                ctx["momentum"] = dashboard.get("momentum")
                ctx["secs_left"] = dashboard.get("secs_left")
                ctx["yes_edge"] = dashboard.get("yes_edge")
                ctx["no_edge"] = dashboard.get("no_edge")
                ctx["fair_value"] = dashboard.get("fair_value")
                ctx["rolling_avg_confidence"] = dashboard.get("rolling_avg_confidence")
                ctx["rolling_avg_max_confidence"] = dashboard.get("rolling_avg_max_confidence")
            context_parts.append(f"LIVE STATUS:\n{json.dumps(ctx, default=str, indent=2)}")

        if trades_summary:
            context_parts.append(f"TRADING PERFORMANCE:\n{json.dumps(trades_summary, indent=2)}")

        if config:
            # Only include key config values
            key_config = {k: v.get("value") if isinstance(v, dict) else v
                         for k, v in config.items()
                         if k in ["MIN_EDGE_CENTS", "RULE_MIN_CONFIDENCE", "VOL_HIGH_THRESHOLD",
                                  "VOL_LOW_THRESHOLD", "LEAD_LAG_THRESHOLD", "DELTA_THRESHOLD"]}
            context_parts.append(f"KEY CONFIG:\n{json.dumps(key_config, indent=2)}")

        if self.last_decision:
            context_parts.append(f"LAST DECISION:\n{json.dumps(self.last_decision, indent=2)}")

        context = "\n\n".join(context_parts) + "\n\n" if context_parts else ""

        system_prompt = """You are the AI advisor for a Kalshi BTC 15-minute binary options trading bot. You have access to live data about the bot's performance, current market conditions, and configuration.

Your role is to:
1. Answer questions about current market conditions and the bot's decisions
2. Analyze trading performance and suggest improvements
3. Recommend config adjustments based on observed patterns
4. Explain why the bot is making certain decisions
5. Help interpret alpha signals (momentum, volatility, lead-lag, fair value)
6. USE THE update_config TOOL when the user asks you to change settings

Key concepts:
- YES/NO are binary outcomes based on whether BTC price is above/below the strike at settlement
- Edge = fair_value - market_price (positive edge means opportunity)
- Volatility affects fair value calculation (higher vol = more uncertainty = prices closer to 50c)
- Lead-lag signal detects when BTC moved but Kalshi hasn't repriced yet
- Confidence threshold determines whether to trade

Available config parameters you can change:
- RULE_MIN_CONFIDENCE: Minimum confidence to trade (0.0-1.0, default 0.7)
- MIN_EDGE_CENTS: Minimum edge in cents to trade (1-20, default 4)
- VOL_HIGH_THRESHOLD: High volatility threshold $/min (50-2000, default 400)
- VOL_LOW_THRESHOLD: Low volatility threshold $/min (20-1000, default 200)
- LEAD_LAG_THRESHOLD: Lead-lag signal threshold $ (10-500, default 75)
- DELTA_THRESHOLD: Momentum threshold for front-run (5-100, default 20)

When asked to change settings, USE THE TOOL - don't just suggest changes. After changing, confirm what you changed."""

        # Define tool for updating config
        tools = [
            {
                "name": "update_config",
                "description": "Update a bot configuration setting. Use this when the user asks to change a setting.",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "setting": {
                            "type": "string",
                            "description": "The config key to update (e.g., RULE_MIN_CONFIDENCE, MIN_EDGE_CENTS)"
                        },
                        "value": {
                            "type": "number",
                            "description": "The new value for the setting"
                        }
                    },
                    "required": ["setting", "value"]
                }
            }
        ]

        # Build messages list with history
        messages = []

        # First message includes live context
        if history:
            # Add context to first user message, then include history
            first_msg = history[0] if history else None
            if first_msg and first_msg.get("role") == "user":
                messages.append({"role": "user", "content": context + first_msg["content"]})
                messages.extend(history[1:])
            else:
                messages.extend(history)
            # Add current message
            messages.append({"role": "user", "content": user_message})
        else:
            # No history - single message with context
            messages.append({"role": "user", "content": context + "USER QUESTION: " + user_message})

        try:
            response = await self.client.messages.create(
                model="claude-3-5-haiku-latest",
                max_tokens=800,
                system=system_prompt,
                tools=tools,
                messages=messages,
            )

            # Check for tool use
            tool_results = []
            final_text = ""

            for block in response.content:
                if block.type == "text":
                    final_text += block.text
                elif block.type == "tool_use" and block.name == "update_config":
                    # Execute config update
                    setting = block.input.get("setting")
                    value = block.input.get("value")
                    result = {"success": False, "message": "No config updater available"}

                    if config_updater and setting and value is not None:
                        try:
                            applied = config_updater({setting: value})
                            if applied:
                                result = {"success": True, "message": f"Updated {setting} to {value}"}
                            else:
                                result = {"success": False, "message": f"Failed to update {setting}"}
                        except Exception as e:
                            result = {"success": False, "message": str(e)}

                    tool_results.append({
                        "type": "tool_result",
                        "tool_use_id": block.id,
                        "content": json.dumps(result)
                    })

            # If there were tool calls, get final response
            if tool_results:
                messages.append({"role": "assistant", "content": response.content})
                messages.append({"role": "user", "content": tool_results})

                final_response = await self.client.messages.create(
                    model="claude-3-5-haiku-latest",
                    max_tokens=400,
                    system=system_prompt,
                    messages=messages,
                )
                return final_response.content[0].text.strip()

            return final_text.strip() if final_text else "I couldn't generate a response."
        except Exception as exc:
            return f"Error: {exc}"
