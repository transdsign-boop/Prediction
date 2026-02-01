import { useState, useEffect, useRef } from 'react'

const CONTRACT_DURATION = 15 * 60

export default function ContractCard({ status }) {
  const { close_time, seconds_to_close, strike_price, alpha, market, orderbook, market_title } = status
  const a = alpha || {}
  const ob = orderbook || {}
  const btcPrice = a.projected_settlement || a.coinbase_price || a.binance_price || null

  // ── Smooth countdown ──
  const [displaySeconds, setDisplaySeconds] = useState(null)
  const closeTimeRef = useRef(null)

  useEffect(() => {
    if (close_time) {
      closeTimeRef.current = close_time
      const secs = Math.max(0, (new Date(close_time).getTime() - Date.now()) / 1000)
      setDisplaySeconds(secs)
    } else {
      closeTimeRef.current = null
      setDisplaySeconds(null)
    }
  }, [close_time, seconds_to_close])

  useEffect(() => {
    if (!closeTimeRef.current) return
    const interval = setInterval(() => {
      const secs = Math.max(0, (new Date(closeTimeRef.current).getTime() - Date.now()) / 1000)
      setDisplaySeconds(secs)
    }, 1000)
    return () => clearInterval(interval)
  }, [close_time])

  if (displaySeconds == null || !close_time) {
    return (
      <div className="card p-4 mb-4">
        <p className="text-xs text-gray-600 text-center">No active contract</p>
      </div>
    )
  }

  // Timer
  const mins = Math.floor(displaySeconds / 60)
  const secs = Math.floor(displaySeconds % 60)
  const timeStr = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  const elapsed = CONTRACT_DURATION - displaySeconds
  const progressPct = Math.min(100, Math.max(0, (elapsed / CONTRACT_DURATION) * 100))

  const urgent = displaySeconds <= 60
  const warning = displaySeconds <= 180

  const barColor = urgent ? 'bg-red-500' : warning ? 'bg-amber-500' : 'bg-blue-500'
  const timerColor = urgent ? 'text-red-400' : warning ? 'text-amber-400' : 'text-gray-100'

  // Strike / price
  const hasStrike = strike_price != null && strike_price > 0
  const hasPrice = btcPrice != null && btcPrice > 0
  const diff = hasStrike && hasPrice ? btcPrice - strike_price : 0
  const aboveStrike = diff >= 0

  const RANGE = 500
  const pricePosition = hasStrike && hasPrice
    ? Math.min(100, Math.max(0, 50 + (diff / RANGE) * 50))
    : 50

  const fmtPrice = (n) => n ? '$' + n.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',') : '--'

  // Orderbook
  const bestBid = ob.best_bid ?? null
  const bestAsk = ob.best_ask ?? null
  const spread = ob.spread ?? '--'

  // YES/NO probability from midpoint of bid/ask
  const hasBidAsk = bestBid != null && bestAsk != null && bestBid > 0
  const yesPct = hasBidAsk ? Math.round((bestBid + bestAsk) / 2) : null
  const noPct = yesPct != null ? 100 - yesPct : null

  // Ticker label (shortened)
  const ticker = (market || '').replace('KXBTC15M-', '')

  return (
    <div className="card p-4 mb-4">
      {/* Row 1: Timer + ticker + bid/ask */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <span className={`text-2xl font-bold font-mono tracking-wider ${timerColor}`}>
            {timeStr}
          </span>
          <span className="text-[10px] text-gray-600">{ticker}</span>
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-lg font-bold font-mono text-green-400">{bestBid ?? '--'}</span>
          <span className="text-gray-700">/</span>
          <span className="text-lg font-bold font-mono text-red-400">{bestAsk ?? '--'}</span>
          <span className="text-[10px] text-gray-600 ml-0.5">{spread}c</span>
        </div>
      </div>

      {/* YES/NO probability bar */}
      {yesPct != null && (
        <div className="flex items-center gap-0 h-5 rounded overflow-hidden mb-2">
          <div className="h-full bg-green-500/20 flex items-center justify-start px-2 transition-all duration-500" style={{ width: `${yesPct}%` }}>
            <span className="text-[10px] font-mono font-semibold text-green-400">YES {yesPct}%</span>
          </div>
          <div className="h-full bg-red-500/20 flex items-center justify-end px-2 transition-all duration-500" style={{ width: `${noPct}%` }}>
            <span className="text-[10px] font-mono font-semibold text-red-400">{noPct}% NO</span>
          </div>
        </div>
      )}

      {/* Progress bar */}
      <div className="w-full bg-white/[0.04] rounded-full h-1 mb-2">
        <div
          className={`h-full rounded-full transition-all duration-1000 ${barColor}`}
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* Price vs Strike bar */}
      {hasStrike && (
        <div className="relative h-5 rounded overflow-hidden bg-gradient-to-r from-red-500/10 via-transparent to-green-500/10">
          <div className="absolute inset-y-0 left-1/2 w-px bg-white/15" />
          {hasPrice && (
            <div
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-20 transition-all duration-700"
              style={{ left: `${pricePosition}%` }}
            >
              <div className={`w-2.5 h-2.5 rounded-full border-2 ${
                aboveStrike
                  ? 'bg-green-500 border-green-400 shadow-[0_0_6px_rgba(34,197,94,0.5)]'
                  : 'bg-red-500 border-red-400 shadow-[0_0_6px_rgba(239,68,68,0.5)]'
              }`} />
            </div>
          )}
          <div className="absolute inset-0 flex items-center justify-between px-2">
            <span className="text-[9px] font-mono text-gray-600">Strike {fmtPrice(strike_price)}</span>
            {hasPrice && (
              <span className={`text-[9px] font-mono font-semibold ${aboveStrike ? 'text-green-400' : 'text-red-400'}`}>
                {diff >= 0 ? '+' : ''}{diff.toFixed(0)} {aboveStrike ? 'YES' : 'NO'}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
