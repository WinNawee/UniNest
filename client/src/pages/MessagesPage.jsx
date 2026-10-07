import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { MessageCircle } from 'lucide-react'
import { api } from '../api'
import { useChat } from '../chat'
import { Avatar, Card, PageTitle } from '../components/ui'

const when = (iso) => {
  const d = new Date(iso)
  return d.toDateString() === new Date().toDateString()
    ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString([], { day: 'numeric', month: 'short' })
}

export default function MessagesPage({ me }) {
  const { version } = useChat()
  const [chats, setChats] = useState(null)

  useEffect(() => {
    api('/chats').then((d) => setChats(d.chats)).catch(() => setChats([]))
  }, [version])

  return (
    <div className="max-w-2xl mx-auto">
      <PageTitle title="Messages" subtitle="Conversations with roommates and landlords." />
      {!chats ? <p>Loading...</p> : chats.length === 0 ? (
        <Card className="text-center py-10">
          <MessageCircle className="mx-auto text-nest mb-2" />
          <p className="font-semibold">No conversations yet</p>
          {me.role === 'student' && <p className="text-sm text-ink/60">Open a match and tap "Chat in app" to say hello.</p>}
        </Card>
      ) : (
        <Card className="!p-0 divide-y divide-black/5 overflow-hidden">
          {chats.map((c) => (
            <Link key={c.userId} to={`/chat/${c.userId}`} className="flex items-center gap-3 px-4 py-3 hover:bg-nest-soft/50">
              <Avatar name={c.name} />
              <div className="flex-1 min-w-0">
                <div className="flex justify-between gap-2">
                  <p className={`truncate ${c.unread ? 'font-bold' : 'font-semibold'}`}>{c.name}</p>
                  <span className="text-xs text-ink/50 shrink-0">{when(c.last.at)}</span>
                </div>
                <p className={`text-sm truncate ${c.unread ? 'text-ink' : 'text-ink/60'}`}>
                  {c.last.from === me.id ? 'You: ' : ''}{c.last.text}
                </p>
              </div>
              {c.unread > 0 && (
                <span className="min-w-6 h-6 px-1.5 grid place-items-center rounded-full bg-nest text-white text-xs font-bold">{c.unread}</span>
              )}
            </Link>
          ))}
        </Card>
      )}
    </div>
  )
}
