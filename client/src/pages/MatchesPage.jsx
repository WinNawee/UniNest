import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, MapPin, MessageCircle, Sparkles } from 'lucide-react'
import { api } from '../api'
import { Avatar, Button, Card, ErrorText, PageTitle, ScoreBar } from '../components/ui'

const LABELS = {
  cleanliness: 'Tidiness', sleep: 'Sleep schedule', budget: 'Budget', noise: 'Noise',
  social: 'Social life', study: 'Study habits', guests: 'Guests', culture: 'Culture and language', smoking: 'Smoking',
}

const tier = (s) =>
  s >= 80 ? { label: 'Great fit', cls: 'bg-nest text-white' }
  : s >= 60 ? { label: 'Good fit', cls: 'bg-nest-soft text-nest-dark' }
  : { label: 'Some differences', cls: 'bg-amber-100 text-amber-900' }

export default function MatchesPage() {
  const [matches, setMatches] = useState(null)
  const [open, setOpen] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api('/matches').then((d) => setMatches(d.matches)).catch((e) => setError(e.message))
  }, [])

  if (error) return <ErrorText>{error}</ErrorText>
  if (!matches) return <p>Finding your matches...</p>

  return (
    <div>
      <PageTitle title="Your roommate matches" subtitle="Ranked by how well your lifestyle, budget and habits fit together." />
      {matches.length === 0 && <Card>No matches yet. More students will appear as they join your university.</Card>}
      <div className="grid gap-4">
        {matches.map((m, i) => {
          const t = tier(m.score)
          return (
            <Card key={m.userId} className="transition hover:shadow-md">
              <div className="flex items-center gap-4">
                <Avatar name={m.name} size="lg" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-lg">{m.name}</h3>
                    <span className={`text-xs font-semibold rounded-full px-2 py-0.5 ${t.cls}`}>{t.label}</span>
                    {i === 0 && <span className="text-xs font-semibold rounded-full px-2 py-0.5 bg-sun flex items-center gap-1"><Sparkles size={12} /> Top match</span>}
                  </div>
                  <p className="text-sm text-ink/60 mb-2 flex items-center gap-1"><MapPin size={13} /> {m.campus}</p>
                  <ScoreBar value={m.score} />
                </div>
                <div className="text-right">
                  <span className="text-3xl font-bold text-nest">{m.score}</span>
                  <span className="text-nest font-semibold">%</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mt-4">
                <Link
                  to={`/chat/${m.userId}`}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl font-semibold bg-nest text-white hover:bg-nest-dark shadow-sm shadow-nest/20"
                >
                  <MessageCircle size={16} /> Chat in app
                </Link>
                <Button variant="ghost" onClick={() => setOpen(open === m.userId ? null : m.userId)}>
                  Why this match?
                  <ChevronDown size={16} className={`transition ${open === m.userId ? 'rotate-180' : ''}`} />
                </Button>
              </div>
              {open === m.userId && (
                <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2.5 mt-4 pt-4 border-t border-black/5">
                  {Object.entries(m.breakdown).map(([k, v]) => (
                    <div key={k}>
                      <div className="flex justify-between text-sm"><span>{LABELS[k]}</span><span className="font-semibold">{v}%</span></div>
                      <ScoreBar value={v} />
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )
        })}
      </div>
    </div>
  )
}
