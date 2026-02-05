import os
import base64
import tempfile
from dotenv import load_dotenv

load_dotenv()

# --- Handle base64-encoded private keys (for Fly.io deployment) ---
def _decode_pem_if_needed(path_env_var: str, b64_env_var: str) -> str:
    """
    If a base64-encoded PEM is provided via env var, decode it to a temp file.
    Otherwise, use the path from the environment.
    """
    b64_key = os.getenv(b64_env_var)
    if b64_key:
        # Decode base64 and write to temporary file
        pem_content = base64.b64decode(b64_key)
        temp_file = tempfile.NamedTemporaryFile(mode='wb', delete=False, suffix='.pem')
        temp_file.write(pem_content)
        temp_file.close()
        return temp_file.name
    else:
        # Use the path from environment
        return os.getenv(path_env_var, "")

# --- Per-environment Kalshi credentials ---
KALSHI_LIVE_API_KEY_ID = os.getenv("KALSHI_LIVE_API_KEY_ID", "")
KALSHI_LIVE_PRIVATE_KEY_PATH = _decode_pem_if_needed(
    "KALSHI_LIVE_PRIVATE_KEY_PATH",
    "KALSHI_LIVE_PRIVATE_KEY_B64"
)

KALSHI_DEMO_API_KEY_ID = os.getenv("KALSHI_DEMO_API_KEY_ID", "")
KALSHI_DEMO_PRIVATE_KEY_PATH = _decode_pem_if_needed(
    "KALSHI_DEMO_PRIVATE_KEY_PATH",
    "KALSHI_DEMO_PRIVATE_KEY_B64"
)

# Active environment: "demo" or "live"
KALSHI_ENV = os.getenv("KALSHI_ENV", "demo")

# Always use live credentials — demo mode is paper trading on the live API
KALSHI_API_KEY_ID = KALSHI_LIVE_API_KEY_ID
KALSHI_API_PRIVATE_KEY_PATH = KALSHI_LIVE_PRIVATE_KEY_PATH

KALSHI_HOST = "https://api.elections.kalshi.com"

# --- Anthropic ---
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")

# --- Trading Rules (mutable at runtime) ---
# Percentage-based sizing: scales automatically with account balance
ORDER_SIZE_PCT = float(os.getenv("ORDER_SIZE_PCT", "5.0"))             # % of balance per order
MAX_POSITION_PCT = float(os.getenv("MAX_POSITION_PCT", "15.0"))        # % of balance max position
MAX_TOTAL_EXPOSURE_PCT = float(os.getenv("MAX_TOTAL_EXPOSURE_PCT", "30.0"))  # % of balance max exposure
MAX_DAILY_LOSS_PCT = float(os.getenv("MAX_DAILY_LOSS_PCT", "10.0"))    # % of balance max daily loss
TRADING_ENABLED = os.getenv("TRADING_ENABLED", "false").lower() == "true"

# Target market series
MARKET_SERIES = "KXBTC15M"

# Safety thresholds
MIN_SECONDS_TO_CLOSE = 90
MAX_SPREAD_CENTS = 25
MIN_CONTRACT_PRICE = 5
MAX_CONTRACT_PRICE = 85           # avoid buying above this (bad risk/reward)
STOP_LOSS_CENTS = 0               # DISABLED — trust edge-exit only

# Profit-taking (DISABLED for scalping — use edge-fade exit instead)
HIT_RUN_PCT = float(os.getenv("HIT_RUN_PCT", "0"))  # DISABLED
PROFIT_TAKE_PCT = 0               # DISABLED — no fixed profit targets
FREE_ROLL_PRICE = 999             # DISABLED — effectively never triggers
PROFIT_TAKE_MIN_SECS = 300        # Not used when PROFIT_TAKE_PCT = 0
HOLD_EXPIRY_SECS = 0              # DISABLED — allow exits in final minutes

# SCALPING PARAMETERS: Edge-based entry/exit with unlimited re-entries (REAL-TIME OPTIMIZED)
QUICK_PROFIT_CENTS = int(os.getenv("QUICK_PROFIT_CENTS", "4"))          # take profit when position profit >= this (cents per contract)
EDGE_FADE_THRESHOLD = int(os.getenv("EDGE_FADE_THRESHOLD", "1"))        # exit when remaining edge <= this (cents) - backup exit
MIN_HOLD_SECONDS = int(os.getenv("MIN_HOLD_SECONDS", "3"))              # min hold before exit (fast scalping - 3s)
REENTRY_COOLDOWN_SECONDS = int(os.getenv("REENTRY_COOLDOWN_SECONDS", "3"))  # cooldown after exit before re-entry (3s for max speed)
BASE_POSITION_SIZE_PCT = float(os.getenv("BASE_POSITION_SIZE_PCT", "5.0"))    # default position size (% of balance)
MAX_POSITION_SIZE_PCT = float(os.getenv("MAX_POSITION_SIZE_PCT", "15.0"))     # max position size (% of balance)
STRONG_EDGE_THRESHOLD = int(os.getenv("STRONG_EDGE_THRESHOLD", "8"))          # edge threshold for scaling up position

# Alpha Engine thresholds
DELTA_THRESHOLD = 20              # USD — front-run trigger (momentum deviation)
EXTREME_DELTA_THRESHOLD = 50      # USD — aggressive execution trigger
ANCHOR_SECONDS_THRESHOLD = 60     # seconds — anchor defense trigger
LEAD_LAG_THRESHOLD = 75           # USD — lead-lag signal trigger (global price vs strike). BTC moves ~$77/min avg.
LEAD_LAG_ENABLED = os.getenv("LEAD_LAG_ENABLED", "false").lower() == "true"  # Enable/disable lead-lag signal

# Rule-based strategy (replaces Claude AI fallback)
VOL_HIGH_THRESHOLD = float(os.getenv("VOL_HIGH_THRESHOLD", "400.0"))          # $/min tick path — above = high vol (trend-follow). Tick path ~5x candle; BTC avg candle ~$87 ≈ $500 tick.
VOL_LOW_THRESHOLD = float(os.getenv("VOL_LOW_THRESHOLD", "200.0"))            # $/min tick path — below = low vol (sit out). BTC quiet candle ~$40 ≈ $200 tick.
FAIR_VALUE_K = float(os.getenv("FAIR_VALUE_K", "0.6"))                       # logistic steepness — 0.6 = moderate. Lower = less extreme probabilities, finds more edge in 15-85c range
MIN_EDGE_CENTS = int(os.getenv("MIN_EDGE_CENTS", "3"))                      # min mispricing to trade (3c = scalping threshold, more opportunities)
TREND_FOLLOW_VELOCITY = float(os.getenv("TREND_FOLLOW_VELOCITY", "2.0"))     # $/sec — BTC ~$120/min = $2/sec triggers trend bonus
RULE_SIT_OUT_LOW_VOL = os.getenv("RULE_SIT_OUT_LOW_VOL", "true").lower() == "true"
RULE_MIN_CONFIDENCE = float(os.getenv("RULE_MIN_CONFIDENCE", "0.6"))         # min confidence to execute (0.6 = needs real edge + time)

# Paper trading (demo mode uses live API but simulates trades)
PAPER_STARTING_BALANCE = float(os.getenv("PAPER_STARTING_BALANCE", "100.0"))
PAPER_FILL_FRACTION = float(os.getenv("PAPER_FILL_FRACTION", "1.0"))  # fraction of book depth filled (1.0 = full depth, crossing orders fill against all resting liquidity)

# Live trading starting balance (for PnL calculation - set to your balance on Feb 1, 2026)
LIVE_STARTING_BALANCE = float(os.getenv("LIVE_STARTING_BALANCE", "277.0"))

# Loop interval (reduced for real-time fair value updates)
POLL_INTERVAL_SECONDS = 5


# --- Runtime helpers ---
TUNABLE_FIELDS = {
    "TRADING_ENABLED":      {"type": "bool"},
    "ORDER_SIZE_PCT":       {"type": "float", "min": 0.5, "max": 50},
    "MAX_POSITION_PCT":     {"type": "float", "min": 1,   "max": 100},
    "MAX_TOTAL_EXPOSURE_PCT": {"type": "float", "min": 1, "max": 100},
    "MAX_DAILY_LOSS_PCT":   {"type": "float", "min": 1,   "max": 100},
    "MIN_SECONDS_TO_CLOSE": {"type": "int",   "min": 30, "max": 600},
    "MAX_SPREAD_CENTS":     {"type": "int",   "min": 1,  "max": 100},
    "MIN_CONTRACT_PRICE":   {"type": "int",   "min": 1,  "max": 55},
    "MAX_CONTRACT_PRICE":   {"type": "int",   "min": 50, "max": 99},
    "STOP_LOSS_CENTS":      {"type": "int",   "min": 0,  "max": 99},
    "HIT_RUN_PCT":          {"type": "float", "min": 0,  "max": 500},
    "PROFIT_TAKE_PCT":      {"type": "int",   "min": 0,  "max": 500},
    "FREE_ROLL_PRICE":      {"type": "int",   "min": 75, "max": 999},
    "PROFIT_TAKE_MIN_SECS": {"type": "int",   "min": 60, "max": 600},
    "HOLD_EXPIRY_SECS":     {"type": "int",   "min": 0, "max": 300},
    "POLL_INTERVAL_SECONDS":{"type": "int",   "min": 3,  "max": 120},
    "DELTA_THRESHOLD":          {"type": "int",   "min": 5,   "max": 200},
    "EXTREME_DELTA_THRESHOLD":  {"type": "int",   "min": 10,  "max": 500},
    "ANCHOR_SECONDS_THRESHOLD": {"type": "int",   "min": 15,  "max": 120},
    "LEAD_LAG_THRESHOLD":       {"type": "int",   "min": 10,  "max": 500},
    "LEAD_LAG_ENABLED":         {"type": "bool"},
    "VOL_HIGH_THRESHOLD":       {"type": "float", "min": 50.0, "max": 2000.0},
    "VOL_LOW_THRESHOLD":        {"type": "float", "min": 20.0, "max": 1000.0},
    "FAIR_VALUE_K":             {"type": "float", "min": 0.1, "max": 3.0},
    "MIN_EDGE_CENTS":           {"type": "int",   "min": 1,  "max": 30},
    "TREND_FOLLOW_VELOCITY":    {"type": "float", "min": 0.5, "max": 20.0},
    "RULE_SIT_OUT_LOW_VOL":     {"type": "bool"},
    "RULE_MIN_CONFIDENCE":      {"type": "float", "min": 0.3, "max": 0.95},
    "QUICK_PROFIT_CENTS":       {"type": "int",   "min": 1,  "max": 20},
    "EDGE_FADE_THRESHOLD":      {"type": "int",   "min": 0,  "max": 15},
    "MIN_HOLD_SECONDS":         {"type": "int",   "min": 1,  "max": 120},
    "REENTRY_COOLDOWN_SECONDS": {"type": "int",   "min": 5,  "max": 120},
    "BASE_POSITION_SIZE_PCT":   {"type": "float", "min": 1.0, "max": 50.0},
    "MAX_POSITION_SIZE_PCT":    {"type": "float", "min": 1.0, "max": 50.0},
    "STRONG_EDGE_THRESHOLD":    {"type": "int",   "min": 3,  "max": 20},
    "PAPER_STARTING_BALANCE":   {"type": "float", "min": 10,  "max": 100000},
    "PAPER_FILL_FRACTION":      {"type": "float", "min": 0.05, "max": 1.0},
    "LIVE_STARTING_BALANCE":    {"type": "float", "min": 10,  "max": 100000},
}


def get_tunables() -> dict:
    return {k: getattr(__import__(__name__), k) for k in TUNABLE_FIELDS}


def set_tunables(updates: dict) -> dict:
    import config as _self
    from database import set_setting
    applied = {}
    for key, value in updates.items():
        spec = TUNABLE_FIELDS.get(key)
        if spec is None:
            continue
        try:
            if spec["type"] == "bool":
                value = value if isinstance(value, bool) else str(value).lower() in ("true", "1")
            elif spec["type"] == "int":
                value = max(spec["min"], min(spec["max"], int(value)))
            elif spec["type"] == "float":
                value = max(spec["min"], min(spec["max"], float(value)))
            setattr(_self, key, value)
            set_setting(f"config_{key}", str(value))
            applied[key] = value
        except (ValueError, TypeError):
            continue
    return applied


def restore_tunables():
    """Restore persisted tunable config values from the database."""
    import config as _self
    from database import get_setting
    for key, spec in TUNABLE_FIELDS.items():
        saved = get_setting(f"config_{key}")
        if saved is None:
            continue
        try:
            if spec["type"] == "bool":
                setattr(_self, key, saved.lower() in ("true", "1"))
            elif spec["type"] == "int":
                setattr(_self, key, int(saved))
            elif spec["type"] == "float":
                setattr(_self, key, float(saved))
        except (ValueError, TypeError):
            continue


