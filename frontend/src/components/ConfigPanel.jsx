import { useState, useEffect } from 'react'
import { fetchConfig, postConfig } from '../api'

// Scalping Strategy: Simplified config for edge-based trading
const SETTINGS = {
  TRADING_ENABLED: {
    label: 'Trading Enabled',
    desc: 'Master switch. When off, the bot analyzes markets but never places real orders.',
  },
  POLL_INTERVAL_SECONDS: {
    label: 'Poll Interval',
    unit: 's',
    desc: 'Seconds between each bot cycle. Lower = more responsive but more API calls.',
  },
  PAPER_STARTING_BALANCE: {
    label: 'Paper Balance',
    unit: '$',
    desc: 'Starting balance for paper trading. Use the Reset button in the header to apply a new value.',
  },
  PAPER_FILL_FRACTION: {
    label: 'Paper Fill Realism',
    unit: '',
    desc: 'Fraction of orderbook depth available per fill. 0.1 = pessimistic, 0.5 = realistic, 1.0 = optimistic.',
  },
  QUICK_PROFIT_CENTS: {
    label: 'Quick Profit Target',
    unit: 'c',
    desc: 'Take profit when position gains this much per contract. Primary exit rule.',
  },
  EDGE_FADE_THRESHOLD: {
    label: 'Edge Fade Backup',
    unit: 'c',
    desc: 'Backup exit when edge drops to this level. Safety net for wrong positions.',
  },
  MIN_HOLD_SECONDS: {
    label: 'Min Hold Time',
    unit: 's',
    desc: 'Minimum time to hold a position before exiting. Prevents thrashing on rapid price swings.',
  },
  REENTRY_COOLDOWN_SECONDS: {
    label: 'Re-Entry Cooldown',
    unit: 's',
    desc: 'Wait time after exit before allowing re-entry. Prevents immediate re-entry on same tick.',
  },
  BASE_POSITION_SIZE_PCT: {
    label: 'Base Position Size',
    unit: '%',
    desc: 'Default % of balance per trade. Scales up for strong edge.',
  },
  MAX_POSITION_SIZE_PCT: {
    label: 'Max Position Size',
    unit: '%',
    desc: 'Maximum % of balance in a single trade. Caps position sizing.',
  },
  STRONG_EDGE_THRESHOLD: {
    label: 'Strong Edge',
    unit: 'c',
    desc: 'Edge threshold to scale up position size. 8c+ = max size.',
  },
  MAX_POSITION_PCT: {
    label: 'Max Position Value',
    unit: '%',
    desc: 'Maximum % of balance in a single contract (fallback if position size exceeds budget).',
  },
  MAX_TOTAL_EXPOSURE_PCT: {
    label: 'Max Total Exposure',
    unit: '%',
    desc: 'Maximum % of balance at risk across all open positions combined.',
  },
  FAIR_VALUE_K: {
    label: 'Fair Value Steepness',
    unit: '',
    desc: 'How aggressively fair value reacts to BTC distance from strike. 0.6 = moderate.',
  },
}

const GROUPS = [
  {
    title: 'General',
    keys: ['TRADING_ENABLED', 'POLL_INTERVAL_SECONDS', 'PAPER_STARTING_BALANCE', 'PAPER_FILL_FRACTION'],
  },
  {
    title: 'Scalping Strategy',
    keys: ['QUICK_PROFIT_CENTS', 'EDGE_FADE_THRESHOLD', 'MIN_HOLD_SECONDS', 'REENTRY_COOLDOWN_SECONDS', 'BASE_POSITION_SIZE_PCT', 'MAX_POSITION_SIZE_PCT', 'STRONG_EDGE_THRESHOLD'],
  },
  {
    title: 'Risk Management',
    keys: ['MAX_POSITION_PCT', 'MAX_TOTAL_EXPOSURE_PCT'],
  },
  {
    title: 'Advanced',
    keys: ['FAIR_VALUE_K'],
  },
]

export default function ConfigPanel() {
  const [cfgMeta, setCfgMeta] = useState(null)
  const [statusMsg, setStatusMsg] = useState({ text: '', ok: true })
  const [saving, setSaving] = useState(false)

  const refresh = () => fetchConfig().then(setCfgMeta).catch(console.error)

  useEffect(() => {
    refresh()
    // Re-fetch when config is changed elsewhere (e.g. analytics suggestion applied)
    const handler = () => refresh()
    window.addEventListener('config-updated', handler)
    return () => window.removeEventListener('config-updated', handler)
  }, [])

  function showStatus(text, ok) {
    setStatusMsg({ text, ok })
    setTimeout(() => setStatusMsg({ text: '', ok: true }), 3000)
  }

  async function handleFieldChange(key, value) {
    const info = SETTINGS[key] || {}
    try {
      await postConfig({ [key]: value })
      showStatus(`Saved: ${info.label || key}`, true)
    } catch {
      showStatus(`Error saving ${info.label || key}`, false)
    }
  }

  async function handleSaveAll() {
    if (!cfgMeta) return
    setSaving(true)
    try {
      const updates = {}
      for (const [key, spec] of Object.entries(cfgMeta)) {
        updates[key] = spec.value
      }
      await postConfig(updates)
      showStatus('All settings saved', true)
    } catch {
      showStatus('Error saving', false)
    }
    setSaving(false)
  }

  function updateLocalValue(key, value) {
    setCfgMeta(prev => ({
      ...prev,
      [key]: { ...prev[key], value },
    }))
  }

  if (!cfgMeta) return <p className="text-xs text-gray-600">Loading config...</p>

  return (
    <div className="space-y-5">
      {GROUPS.map(group => {
        const visibleKeys = group.keys.filter(k => cfgMeta[k])
        if (visibleKeys.length === 0) return null
        return (
          <div key={group.title}>
            <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2.5 border-b border-white/[0.06] pb-1.5">
              {group.title}
            </h3>
            <div className="space-y-3">
              {visibleKeys.map(key => {
                const spec = cfgMeta[key]
                const info = SETTINGS[key] || {}
                return (
                  <div key={key} className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] text-gray-300 font-medium">{info.label || key}</span>
                        {info.unit && <span className="text-[9px] text-gray-600">({info.unit})</span>}
                      </div>
                      <p className="text-[10px] text-gray-600 leading-relaxed mt-0.5">{info.desc}</p>
                    </div>
                    <div className="w-20 shrink-0">
                      {spec.type === 'bool' ? (
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={spec.value}
                            onChange={e => {
                              const val = e.target.checked
                              updateLocalValue(key, val)
                              handleFieldChange(key, val)
                            }}
                            className="sr-only peer"
                          />
                          <div className="w-8 h-4 bg-gray-700 peer-checked:bg-green-500 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all" />
                        </label>
                      ) : (
                        <input
                          type="number"
                          value={spec.value}
                          min={spec.min}
                          max={spec.max}
                          step={spec.type === 'float' ? (spec.min < 0.001 ? '0.00001' : '0.01') : '1'}
                          onChange={e => {
                            const val = spec.type === 'float' ? parseFloat(e.target.value) : parseInt(e.target.value, 10)
                            updateLocalValue(key, val)
                          }}
                          onBlur={e => {
                            const val = spec.type === 'float' ? parseFloat(e.target.value) : parseInt(e.target.value, 10)
                            if (!isNaN(val)) handleFieldChange(key, val)
                          }}
                          className="w-full bg-black/20 border border-white/[0.06] rounded px-2 py-1 text-xs text-gray-200 text-right focus:outline-none focus:border-blue-500/50"
                        />
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      <div className="flex items-center justify-between pt-2 border-t border-white/[0.06]">
        <button
          onClick={handleSaveAll}
          disabled={saving}
          className="px-3 py-1.5 rounded-lg bg-purple-500/20 text-purple-400 text-[11px] font-semibold hover:bg-purple-500/30 transition disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save All'}
        </button>
        {statusMsg.text && (
          <span className={`text-[11px] ${statusMsg.ok ? 'text-green-400' : 'text-red-400'}`}>
            {statusMsg.text}
          </span>
        )}
      </div>
    </div>
  )
}
