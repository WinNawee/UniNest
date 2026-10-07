import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Lock, SendHorizontal } from 'lucide-react'
import { api } from '../api'
import { useChat } from '../chat'
import { Avatar, Card, ErrorText, inputClass } from '../components/ui'

const STARTERS = [
  'Hi! Are you still looking for a roommate?',
  'What is your monthly budget?',
  'Which area near campus do you prefer?',
]

const time = (iso) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

export default function ChatPage({ me }) {
  const { userId } = useParams()
  const { status, version, send, refreshUnread } = useChat()
  const [partner, setPartner] = useState(null)
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    let alive = true
    api(`/chats/${userId}`)
      .then((d) => {
        if (!alive) return
        setPartner(d.partner)
        setMessages(d.messages)
        refreshUnread()
      })
      .catch((e) => alive && setError(e.message))
    return () => { alive = false }
  }, [userId, version, refreshUnread])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  async function submit(e) {
    e.preventDefault()
    const value = text.trim()
    if (!value || sending) return
    setSending(true)
    setError('')
    try {
      const msg = await send(userId, value)
      setMessages((prev) => (prev.some((x) => x.id === msg.id) ? prev : [...prev, msg]))
      setText('')
    } catch (err) {
      setError(err.message)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Card className="!p-0 overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-black/5 bg-nest-soft/60">
          <Link to="/messages" className="p-1.5 rounded-lg hover:bg-white" aria-label="Back to messages">
            <ArrowLeft size={18} />
          </Link>
          {partner && <Avatar name={partner.name} size="sm" />}
          <div className="flex-1">
            <p className="font-bold leading-tight">{partner?.name || '...'}</p>
            <p className="text-xs text-ink/60 flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${status === 'live' ? 'bg-nest' : 'bg-sun'}`} />
              {status === 'live' ? 'Live' : status === 'connecting' ? 'Connecting' : 'Syncing every few seconds'}
            </p>
          </div>
        </div>

        <div className="h-[55vh] overflow-y-auto flex flex-col gap-2 p-4 bg-gradient-to-b from-nest-soft/40 to-cream/60">
          <p className="mx-auto mb-2 text-xs text-ink/60 flex items-center gap-1.5 bg-white rounded-full px-3 py-1 shadow-sm">
            <Lock size={12} /> Contact details stay private until you both choose to share them
          </p>
          {messages.length === 0 && partner && (
            <div className="m-auto text-center max-w-sm">
              <div className="flex justify-center mb-3"><Avatar name={partner.name} size="lg" /></div>
              <p className="font-bold text-lg">Say hi to {partner.name}</p>
              <p className="text-sm text-ink/60 mb-4">Not sure how to start? Tap a suggestion.</p>
              <div className="flex flex-wrap justify-center gap-2">
                {STARTERS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setText(s)}
                    className="text-sm px-3 py-1.5 rounded-full bg-white border border-nest/20 text-nest-dark hover:bg-nest hover:text-white transition"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m) => {
            const mine = m.from === me.id
            return (
              <div key={m.id} className={`max-w-[75%] ${mine ? 'self-end text-right' : 'self-start'}`}>
                <div className={`px-3.5 py-2 rounded-2xl text-left shadow-sm ${mine ? 'bg-nest text-white rounded-br-md' : 'bg-white rounded-bl-md'}`}>
                  {m.text}
                </div>
                <span className="text-[11px] text-ink/50 px-1">{time(m.at)}</span>
              </div>
            )
          })}
          <div ref={bottomRef} />
        </div>

        <form onSubmit={submit} className="flex gap-2 p-3 border-t border-black/5">
          <input
            className={inputClass}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Write a message"
            aria-label="Message"
          />
          <button
            disabled={sending || !text.trim()}
            className="shrink-0 w-11 h-11 grid place-items-center rounded-xl bg-nest text-white hover:bg-nest-dark disabled:opacity-40"
            aria-label="Send"
          >
            <SendHorizontal size={18} />
          </button>
        </form>
      </Card>
      <div className="mt-2"><ErrorText>{error}</ErrorText></div>
    </div>
  )
}
