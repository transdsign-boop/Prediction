import { useState } from 'react'

export default function Collapsible({ title, badge, children }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="card overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/[0.02] transition"
      >
        <span className="text-base font-semibold text-gray-400 font-display tracking-wide">{title.toUpperCase()}</span>
        <div className="flex items-center gap-3">
          {badge && <span className="text-sm font-mono text-gray-500">{badge}</span>}
          <svg
            className={`w-5 h-5 text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>
      <div className={`collapse-body ${open ? 'open' : ''}`}>
        <div className="px-5 pb-5">
          {children}
        </div>
      </div>
    </div>
  )
}
