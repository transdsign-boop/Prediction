import { useState, useRef, useEffect } from 'react'
import { postChat } from '../api'

export default function ChatPanel() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const boxRef = useRef(null)

  useEffect(() => {
    if (boxRef.current) {
      boxRef.current.scrollTop = boxRef.current.scrollHeight
    }
  }, [messages])

  async function handleSubmit(e) {
    e.preventDefault()
    const msg = input.trim()
    if (!msg) return
    setInput('')

    // Build history for API (convert to expected format)
    const history = messages
      .filter(m => m.role !== 'error')
      .map(m => ({
        role: m.role === 'agent' ? 'assistant' : 'user',
        content: m.text
      }))

    setMessages(prev => [...prev, { role: 'user', text: msg }])
    setSending(true)

    try {
      const data = await postChat(msg, history)
      setMessages(prev => [...prev, { role: 'agent', text: data.reply }])
    } catch (err) {
      setMessages(prev => [...prev, { role: 'error', text: err.message }])
    }
    setSending(false)
  }

  // Floating chat button when minimized
  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="fixed bottom-4 right-4 w-14 h-14 rounded-full bg-purple-600 hover:bg-purple-500 text-white shadow-lg flex items-center justify-center transition-all z-50"
        title="Chat with AI"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
        {messages.length > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-xs flex items-center justify-center">
            {messages.length}
          </span>
        )}
      </button>
    )
  }

  // Expanded chat panel
  return (
    <div className="fixed bottom-4 right-4 w-80 sm:w-96 bg-[#1a1d24] border border-white/10 rounded-xl shadow-2xl z-50 flex flex-col max-h-[70vh]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-sm font-medium text-gray-200">AI Advisor</span>
        </div>
        <div className="flex gap-2">
          {messages.length > 0 && (
            <button
              onClick={() => setMessages([])}
              className="text-gray-500 hover:text-gray-300 text-xs"
              title="Clear chat"
            >
              Clear
            </button>
          )}
          <button
            onClick={() => setExpanded(false)}
            className="text-gray-500 hover:text-gray-300"
            title="Minimize"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={boxRef}
        className="flex-1 overflow-y-auto p-3 space-y-3 min-h-[200px] max-h-[400px]"
      >
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 text-sm py-8">
            <p>Ask me about your trading performance,</p>
            <p>strategy recommendations, or current market.</p>
          </div>
        ) : (
          messages.map((m, i) => (
            <div
              key={i}
              className={`text-sm ${m.role === 'user' ? 'text-right' : ''}`}
            >
              <div
                className={`inline-block max-w-[85%] px-3 py-2 rounded-lg ${
                  m.role === 'user'
                    ? 'bg-blue-600/30 text-blue-100'
                    : m.role === 'error'
                    ? 'bg-red-600/20 text-red-300'
                    : 'bg-white/5 text-gray-300'
                }`}
              >
                <div className="whitespace-pre-wrap">{m.text}</div>
              </div>
            </div>
          ))
        )}
        {sending && (
          <div className="text-sm">
            <div className="inline-block bg-white/5 text-gray-400 px-3 py-2 rounded-lg">
              <span className="animate-pulse">Thinking...</span>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <form className="p-3 border-t border-white/10" onSubmit={handleSubmit}>
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Ask anything..."
            className="flex-1 bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-purple-500/50"
          />
          <button
            type="submit"
            disabled={sending}
            className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium transition disabled:opacity-50"
          >
            {sending ? '...' : 'Send'}
          </button>
        </div>
      </form>
    </div>
  )
}
