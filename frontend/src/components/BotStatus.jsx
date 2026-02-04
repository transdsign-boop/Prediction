export default function BotStatus({ status }) {
  const {
    running, last_action, decision, reasoning, alpha_override,
    balance, position_pnl, active_position, orderbook,
    total_account_value
  } = status

  const action = last_action || 'Idle'
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

      {/* Account overview */}
      <div className="pt-3 border-t border-white/[0.06]">
        {/* Row 1: Total account + Position P&L */}
        <div className="flex items-baseline justify-between">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold font-mono text-gray-100">
              ${totalAccount.toFixed(2)}
            </span>
            <span className="text-sm text-gray-500">total</span>
          </div>
          {/* Position P&L (only shown if there's a position) */}
          {posQty > 0 && (
            <div className="flex items-baseline gap-2">
              <span className={`text-xl font-bold font-mono ${posPnl >= 0 ? 'text-green-400 glow-green' : 'text-red-400 glow-red'}`}>
                {posPnl >= 0 ? '+$' : '-$'}{Math.abs(posPnl).toFixed(2)}
              </span>
              <span className="text-sm text-gray-500">position</span>
            </div>
          )}
        </div>

        {/* Row 2: Cash + position breakdown */}
        <div className="flex items-center gap-4 mt-2 text-sm font-mono text-gray-500">
          <span>${bal.toFixed(2)} cash</span>
          {posQty > 0 && (
            <span className="text-gray-500">
              {posQty}x {posSide} @ {costPerContract.toFixed(0)}c → {valuePerContract}c
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
