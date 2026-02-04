import { useState } from 'react'
import { postControl, postEnv, postPaperReset } from '../api'

export default function Header({ status, onAction }) {
  const { running, env, paper_mode } = status
  const [loading, setLoading] = useState(false)

  async function handleControl(action) {
    setLoading(true)
    try {
      await postControl(action)
      setTimeout(onAction, 300)
    } finally {
      setTimeout(() => setLoading(false), 500)
    }
  }

  async function handleEnvSwitch(newEnv) {
    if (!confirm(`Switch to ${newEnv === 'demo' ? 'PAPER' : 'LIVE'} mode? This will stop the bot if running.`)) return
    setLoading(true)
    try {
      await postEnv(newEnv)
      setTimeout(onAction, 300)
    } finally {
      setTimeout(() => setLoading(false), 500)
    }
  }

  async function handlePaperReset() {
    if (!confirm('Reset paper trading? This will stop the bot, clear all positions, and reset your balance to starting amount.')) return
    setLoading(true)
    try {
      await postPaperReset()
      setTimeout(onAction, 300)
    } finally {
      setTimeout(() => setLoading(false), 500)
    }
  }

  return (
    <header className="flex items-center justify-between mb-8">
      <div className="flex items-center gap-4">
        <div
          className={`w-4 h-4 rounded-full flex-shrink-0 ${running ? 'bg-green-500 pulse-live shadow-[0_0_12px_rgba(74,222,128,0.6)]' : 'bg-gray-600'}`}
        />
        <div>
          <h1 className="text-2xl font-bold tracking-wider leading-tight font-display">UP/DOWN 15</h1>
          <p className="text-sm text-gray-400 tracking-wide">
            {env === 'live' ? (
              <span className="text-red-400 font-semibold glow-red">LIVE</span>
            ) : (
              <span className="text-amber-400 font-semibold">PAPER</span>
            )}
            {' '}&middot; {running ? 'Running' : 'Stopped'}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        {paper_mode && (
          <button
            onClick={handlePaperReset}
            disabled={loading}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-amber-400/70 hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 transition disabled:opacity-50"
          >
            Reset
          </button>
        )}
        <button
          onClick={() => handleEnvSwitch(env === 'live' ? 'demo' : 'live')}
          disabled={loading}
          className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-400 hover:text-gray-200 bg-white/[0.04] hover:bg-white/[0.08] transition disabled:opacity-50"
        >
          {env === 'live' ? 'Paper' : 'Live'}
        </button>
        {running ? (
          <button
            onClick={() => handleControl('stop')}
            disabled={loading}
            className="px-5 py-2 rounded-lg bg-red-500/20 text-red-400 text-sm font-bold hover:bg-red-500/30 transition disabled:opacity-50"
          >
            {loading ? 'Stopping...' : 'Stop'}
          </button>
        ) : (
          <button
            onClick={() => handleControl('start')}
            disabled={loading}
            className="px-5 py-2 rounded-lg bg-green-500/20 text-green-400 text-sm font-bold hover:bg-green-500/30 transition disabled:opacity-50"
          >
            {loading ? 'Starting...' : 'Start'}
          </button>
        )}
      </div>
    </header>
  )
}
