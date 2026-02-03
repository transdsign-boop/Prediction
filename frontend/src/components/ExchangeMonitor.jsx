export default function ExchangeMonitor({ status }) {
  const alpha = status.alpha || {}
  const exchangePrices = alpha.exchange_prices || {}
  const globalPrice = alpha.weighted_global_price || 0
  const leadLagSpread = alpha.lead_lag_spread || 0
  const connected = alpha.exchanges_connected || 0
  const total = alpha.exchanges_total || 6

  const exchanges = Object.entries(exchangePrices).sort((a, b) => b[1].weight - a[1].weight)

  // Compute price range for the spread bar
  const prices = exchanges.filter(([, d]) => d.connected && d.price > 0).map(([, d]) => d.price)
  const minPrice = prices.length ? Math.min(...prices) : 0
  const maxPrice = prices.length ? Math.max(...prices) : 0
  const range = maxPrice - minPrice

  return (
    <div className="card px-4 py-3 mb-4">
      {/* Header row: global price + connection dots */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-400">BTC</span>
          {globalPrice > 0 && (
            <span className="text-sm font-mono font-semibold text-gray-100">
              ${globalPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          )}
          {leadLagSpread !== 0 && (
            <span className={`text-xs font-mono ${Math.abs(leadLagSpread) > 50 ? 'text-yellow-400' : 'text-gray-500'}`}>
              {leadLagSpread > 0 ? '+' : ''}{leadLagSpread.toFixed(0)} lag
            </span>
          )}
        </div>
        <div className="flex items-center gap-1" title={`${connected}/${total} exchanges connected`}>
          {exchanges.map(([name, data]) => (
            <div
              key={name}
              className={`w-1.5 h-1.5 rounded-full ${data.connected ? 'bg-green-500' : 'bg-red-500/60'}`}
              title={`${data.label}: ${data.connected && data.price > 0 ? '$' + data.price.toFixed(2) : 'offline'}`}
            />
          ))}
          <span className="text-[10px] text-gray-600 ml-1">{connected}/{total}</span>
        </div>
      </div>

      {/* Compact spread bar — shows price dispersion across exchanges */}
      {prices.length >= 2 && (
        <div className="relative h-5 bg-gray-800/50 rounded overflow-hidden">
          {/* Range label */}
          <div className="absolute inset-0 flex items-center justify-between px-2 z-10">
            <span className="text-[9px] font-mono text-gray-500">${range.toFixed(2)} spread</span>
          </div>
          {/* Exchange price dots positioned along the bar */}
          {exchanges.filter(([, d]) => d.connected && d.price > 0).map(([, data]) => {
            const pct = range > 0 ? ((data.price - minPrice) / range) * 100 : 50
            const clampedPct = Math.max(4, Math.min(96, pct))
            return (
              <div
                key={data.label}
                className="absolute top-1/2 -translate-y-1/2 z-20"
                style={{ left: `${clampedPct}%` }}
                title={`${data.label}: $${data.price.toFixed(2)}`}
              >
                <div className={`w-2 h-2 rounded-full border ${data.role === 'lead' ? 'bg-purple-400 border-purple-300' : 'bg-blue-400 border-blue-300'}`} />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
