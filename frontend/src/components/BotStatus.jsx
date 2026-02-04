export default function BotStatus({ status, tradeData }) {
  const {
    running, last_action, decision, confidence, reasoning, alpha_override,
    balance, day_pnl, position_pnl, active_position, orderbook,
    total_account_value, start_balance
  } = status

  // Trade log totals from actual Kalshi data
  const tradeSummary = tradeData?.summary || {}
  const totalTradePnl = tradeSummary.net_pnl || 0
  const totalTrades = tradeSummary.total_trades || 0
  const conf = Math.round((confidence || 0) * 100)
  const action = last_action || 'Idle'
  const pnl = typeof day_pnl === 'number' ? day_pnl : parseFloat(day_pnl) || 0
  const posPnl = typeof position_pnl === 'number' ? position_pnl : parseFloat(position_pnl) || 0
  const ob = orderbook || {}

  // Accent color from action
  let dotColor = 'bg-gray-600'
  if (running) {
    if (action.includes('Placed') || action.includes('Filled') || action.includes('Retry')) dotColor = 'bg-green-500'
    else if (action.includes('guard') || action.includes('Guard') || action.includes('too cheap') || action.includes('expensive')) dotColor = 'bg-yellow-500'
    else if (action.includes('Error') || action.includes('rejected')) dotColor = 'bg-red-500'
    else dotColor = 'bg-blue-500'
  }

  // Decision badge
  let badgeBg = 'bg-white/[0.06] text-gray-500'
  if (decision === 'BUY_YES') badgeBg = 'bg-green-500/15 text-green-400'
  else if (decision === 'BUY_NO') badgeBg = 'bg-red-500/15 text-red-400'

  // Use backend-computed totals (accurate across all positions)
  const bal = typeof balance === 'number' ? balance : parseFloat(String(balance).replace(/[$,]/g, '')) || 0
  const totalAccount = typeof total_account_value === 'number' ? total_account_value : bal
  const startBal = typeof start_balance === 'number' ? start_balance : totalAccount - pnl
  const pnlPct = startBal > 0 ? (pnl / startBal) * 100 : 0

  // Position detail for display
  let posQty = 0, posSide = '', costPerContract = 0, valuePerContract = 0, posMarketValue = 0
  if (active_position) {
    const rawQty = active_position.position || 0
    const exposureCents = active_position.market_exposure || 0
    posQty = Math.abs(rawQty)
    posSide = rawQty > 0 ? 'YES' : 'NO'
    costPerContract = posQty > 0 ? exposureCents / posQty : 0
    valuePerContract = rawQty > 0 ? (ob.best_bid || 0) : (100 - (ob.best_ask || 100))
    posMarketValue = valuePerContract * posQty / 100
  }

  return (
    <div className="card p-5 mb-5">
      {/* Action line */}
      <div className="flex items-center gap-3 mb-3">
        {running ? (
          <div className="w-5 h-5 rounded-full border-2 border-blue-500 border-t-transparent animate-spin flex-shrink-0" />
        ) : (
          <div className={`w-3 h-3 rounded-full flex-shrink-0 ${dotColor}`} />
        )}
        <span className="text-base font-semibold text-gray-200 truncate flex-1">
          {running ? action : 'Bot stopped'}
        </span>
        {decision && decision !== '—' && (
          <span className={`text-sm font-bold px-2.5 py-1 rounded-full ${badgeBg}`}>
            {decision}
          </span>
        )}
      </div>

      {/* Reasoning - formatted as 2-column bullets */}
      {reasoning && (
        <ul className="text-sm text-gray-500 leading-relaxed mb-3 list-none grid grid-cols-2 gap-x-4 gap-y-1">
          {reasoning.split(';').map((part, i) => {
            const trimmed = part.trim()
            if (!trimmed) return null
            return (
              <li key={i} className="flex items-start gap-2">
                <span className="text-gray-600">•</span>
                <span className="truncate" title={trimmed}>{trimmed}</span>
              </li>
            )
          })}
        </ul>
      )}

      {/* Alpha override */}
      {alpha_override && (
        <p className="text-sm text-purple-400 mb-3">Alpha: {alpha_override}</p>
      )}

      {/* Confidence bar (always visible) */}
      <div className="flex items-center gap-3 mb-4">
        <span className="text-sm text-gray-500 shrink-0 font-semibold">Conf</span>
        <div className="flex-1 h-2.5 bg-white/[0.04] rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${
              conf >= 75 ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : conf >= 50 ? 'bg-yellow-500' : 'bg-red-500'
            }`}
            style={{ width: `${conf}%` }}
          />
        </div>
        <span className={`text-base font-mono font-bold ${conf >= 60 ? 'text-gray-300' : 'text-gray-500'}`}>{conf}%</span>
      </div>

      {/* Account overview */}
      <div className="pt-3 border-t border-white/[0.06]">
        {/* Row 1: Total account + Trade Log P&L */}
        <div className="flex items-baseline justify-between">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold font-mono text-gray-100">
              ${totalAccount.toFixed(2)}
            </span>
            <span className="text-sm text-gray-500">total</span>
          </div>
          <div className="flex items-baseline gap-4">
            {/* Total P&L from trade log (actual Kalshi data) */}
            <div className="flex items-baseline gap-2">
              <span className={`text-xl font-bold font-mono ${totalTradePnl >= 0 ? 'text-green-400 glow-green' : 'text-red-400 glow-red'}`}>
                {totalTradePnl >= 0 ? '+$' : '-$'}{Math.abs(totalTradePnl).toFixed(2)}
              </span>
              <span className="text-sm text-gray-500">{totalTrades}t</span>
            </div>
            {/* Session P&L */}
            <span className={`text-base font-mono ${pnl >= 0 ? 'text-green-400/60' : 'text-red-400/60'}`}>
              {pnl >= 0 ? '+$' : '-$'}{Math.abs(pnl).toFixed(2)}
            </span>
          </div>
        </div>

        {/* Row 2: Cash + position breakdown */}
        <div className="flex items-center gap-4 mt-2 text-sm font-mono text-gray-500">
          <span>${bal.toFixed(2)} cash</span>
          {posQty > 0 && (
            <>
              <span className={posPnl >= 0 ? 'text-green-400/70' : 'text-red-400/70'}>
                ${posMarketValue.toFixed(2)} position
              </span>
              <span className="text-gray-500">
                {posQty}x {posSide} @ {costPerContract.toFixed(0)}c → {valuePerContract}c
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
