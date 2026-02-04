import { useState } from 'react'
import { toPacific } from '../utils/time'
import { postReconcile } from '../api'

export default function TradeLog({ tradeData, mode, actualPnl }) {
  const [syncing, setSyncing] = useState(false)

  const handleReconcile = async () => {
    setSyncing(true)
    try {
      await postReconcile()
    } catch (e) {
      console.error('Reconcile failed:', e)
    } finally {
      setSyncing(false)
    }
  }

  if (!tradeData) return null
  const { trades, summary } = tradeData
  if (!trades || trades.length === 0) {
    return (
      <div className="card p-4 mb-4">
        <p className="text-xs text-gray-600">No trades yet</p>
      </div>
    )
  }

  const { total_trades, wins, losses, pending, net_pnl, win_rate } = summary
  // Use actual Kalshi P&L for live mode (more accurate than reconstructed net_pnl)
  const displayPnl = mode === 'live' && actualPnl != null ? actualPnl : net_pnl

  // Group trades by market_id, preserving newest-first order
  const groups = []
  const groupMap = {}
  for (const t of trades) {
    const mid = t.market_id
    if (!groupMap[mid]) {
      const group = { market_id: mid, entries: [], settled: null }
      groupMap[mid] = group
      groups.push(group)
    }
    groupMap[mid].entries.push(t)
    if (['SELL', 'SETTLED', 'SETTLE', 'SL', 'TP', 'EDGE'].includes(t.action)) {
      groupMap[mid].settled = t
    }
  }

  return (
    <div className="card p-5 mb-5">
      {/* Summary bar */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <p className="text-base font-semibold text-gray-300 font-display tracking-wide">TRADE LOG</p>
          {mode && (
            <span className={`text-sm font-bold px-2.5 py-1 rounded ${mode === 'live' ? 'bg-green-500/15 text-green-400' : 'bg-amber-500/15 text-amber-400'}`}>
              {mode.toUpperCase()}
            </span>
          )}
          <button
            onClick={handleReconcile}
            disabled={syncing}
            className="text-base text-gray-500 hover:text-gray-300 disabled:text-gray-700 transition cursor-pointer ml-1"
            title="Sync all trades from Kalshi"
          >
            {syncing ? (
              <span className="inline-block w-4 h-4 border-2 border-gray-500 border-t-transparent rounded-full animate-spin" />
            ) : (
              '↻'
            )}
          </button>
        </div>
        <div className="flex items-center gap-4 text-sm font-mono">
          <span className="text-gray-500">
            {total_trades} trade{total_trades !== 1 ? 's' : ''}
          </span>
          {total_trades > 0 && (
            <>
              <span className="text-green-400 font-semibold">{wins}W</span>
              <span className="text-red-400 font-semibold">{losses}L</span>
              <span className={`font-bold text-base ${displayPnl >= 0 ? 'text-green-400 glow-green' : 'text-red-400 glow-red'}`}>
                {displayPnl >= 0 ? '+$' : '-$'}{Math.abs(displayPnl).toFixed(2)}
              </span>
              <span className="text-gray-500">{(win_rate * 100).toFixed(0)}%</span>
            </>
          )}
          {pending > 0 && <span className="text-amber-400 font-semibold">{pending} open</span>}
        </div>
      </div>

      {/* Grouped trades */}
      <div className="space-y-1 max-h-80 overflow-y-auto">
        {groups.map((g) => (
          <TradeGroup key={g.market_id} group={g} />
        ))}
      </div>
    </div>
  )
}

function TradeGroup({ group }) {
  const [open, setOpen] = useState(false)
  const { market_id, entries, settled } = group

  const isPaper = market_id.startsWith('[PAPER]')
  const ticker = market_id
    .replace('[PAPER] ', '')
    .replace('KXBTC15M-', '')

  const buys = entries.filter((e) => e.action === 'BUY')
  const totalQty = settled ? settled.quantity : buys.reduce((s, e) => s + e.quantity, 0)
  const side = settled ? settled.side : buys[0]?.side || '?'
  const pnl = settled?.pnl
  const cost = settled?.cost
  const revenue = settled?.revenue
  const fees = settled?.fees
  const isOpen = !settled
  // Use most recent BUY time (when we actually traded), not settle time
  const lastBuy = buys[0]
  const ts = lastBuy?.ts || entries[0]?.ts

  // Chronological order for expanded view
  const chronological = [...entries].reverse()

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 text-sm font-mono py-2.5 px-2 hover:bg-white/[0.03] rounded-lg transition cursor-pointer"
      >
        <span className="text-gray-600 text-sm w-4 shrink-0">{open ? '▼' : '▶'}</span>
        <span className="text-gray-500 w-16 shrink-0">{toPacific(ts)}</span>
        <span className={`w-10 shrink-0 font-bold ${side === 'yes' ? 'text-green-400' : 'text-red-400'}`}>
          {side.toUpperCase()}
        </span>
        <span className="text-gray-400 shrink-0 font-semibold">{totalQty}x</span>
        <span className="text-gray-500 truncate flex-1 text-left">{ticker}</span>
        {isPaper && <span className="text-amber-400/60 text-sm shrink-0">PAPER</span>}
        {isOpen ? (
          <span className="text-amber-400 font-bold shrink-0">OPEN</span>
        ) : pnl != null ? (
          <span className={`shrink-0 font-bold ${pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {pnl >= 0 ? 'W' : 'L'} {pnl >= 0 ? '+$' : '-$'}{Math.abs(pnl).toFixed(2)}
          </span>
        ) : (
          <span className="text-gray-600 shrink-0">--</span>
        )}
        <span className="text-gray-600 text-sm shrink-0">
          {buys.length} order{buys.length !== 1 ? 's' : ''}
        </span>
      </button>

      {open && (
        <div className="ml-5 pl-3 border-l-2 border-white/[0.08] space-y-1 pb-2">
          {/* Cost/Revenue/Fees breakdown for live trades */}
          {cost != null && revenue != null && (
            <div className="flex items-center gap-4 text-sm font-mono text-gray-500 py-2 mb-2 border-b border-white/[0.06]">
              <span>Cost: <span className="text-red-400/80 font-semibold">${cost.toFixed(2)}</span></span>
              <span>Payout: <span className="text-green-400/80 font-semibold">${revenue.toFixed(2)}</span></span>
              {fees > 0 && <span>Fees: <span className="text-amber-400/80 font-semibold">${fees.toFixed(2)}</span></span>}
            </div>
          )}
          {chronological.map((t, i) => {
            const actionColor =
              t.action === 'BUY'
                ? 'text-green-400/80'
                : t.action === 'SELL'
                  ? 'text-red-400/80'
                  : 'text-amber-400/80'
            return (
              <div key={i} className="flex items-center gap-3 text-sm font-mono text-gray-500">
                <span className="w-16 shrink-0">{toPacific(t.ts)}</span>
                <span className={`w-16 shrink-0 font-semibold ${actionColor}`}>{t.action}</span>
                <span>
                  {t.quantity}x {t.side.toUpperCase()} @ {(t.price * 100).toFixed(0)}c
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
