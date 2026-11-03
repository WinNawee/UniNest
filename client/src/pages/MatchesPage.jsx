import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, Crown, Eye, Lock, MapPin, MessageCircle, SlidersHorizontal, Sparkles, X } from 'lucide-react'
import { api } from '../api'
import { Avatar, Button, Card, ErrorText, PageTitle, ScoreBar, inputClass } from '../components/ui'

const LABELS = {
  cleanliness: 'Tidiness', sleep: 'Sleep schedule', budget: 'Budget', noise: 'Noise',
  social: 'Social life', study: 'Study habits', guests: 'Guests', culture: 'Culture and language', smoking: 'Smoking',
}

const tier = (s) =>
  s >= 80 ? { label: 'Great fit', cls: 'bg-nest text-white' }
  : s >= 60 ? { label: 'Good fit', cls: 'bg-nest-soft text-nest-dark' }
  : { label: 'Some differences', cls: 'bg-amber-100 text-amber-900' }

const NO_FILTERS = { minScore: '', gender: '', smoking: '', food: '', sleep: '', language: '', maxBudget: '' }

export default function MatchesPage() {
  const [data, setData] = useState(null)
  const [filters, setFilters] = useState(NO_FILTERS)
  const [open, setOpen] = useState(null)
  const [error, setError] = useState('')

  // Reload whenever the filters change (filters only apply for Premium on the server).
  useEffect(() => {
    const qs = new URLSearchParams(Object.entries(filters).filter(([, v]) => v)).toString()
    api('/matches' + (qs ? `?${qs}` : '')).then(setData).catch((e) => setError(e.message))
  }, [filters])

  function toggle(userId) {
    const opening = open !== userId
    setOpen(opening ? userId : null)
    // Opening "Why this match?" counts as viewing their profile.
    if (opening) api(`/profile-views/${userId}`, { method: 'POST' }).catch(() => {})
  }

  if (error) return <ErrorText>{error}</ErrorText>
  if (!data) return <p>Finding your matches...</p>
  const { matches } = data
  const filtering = Object.values(filters).some(Boolean)

  return (
    <div>
      <PageTitle title="Your roommate matches" subtitle="Ranked by how well your lifestyle, budget and habits fit together." />

      <div className="grid md:grid-cols-2 gap-4 mb-5">
        <WhoViewedCard />
        <FilterCard locked={data.filtersLocked} filters={filters} setFilters={setFilters} />
      </div>

      {matches.length === 0 && (
        <Card>{filtering ? 'No matches with these filters. Try removing one.' : 'No matches yet. More students will appear as they join your university.'}</Card>
      )}
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
                    {m.premium && <span className="text-xs font-semibold rounded-full px-2 py-0.5 bg-amber-100 text-amber-900 flex items-center gap-1"><Crown size={12} /> Premium</span>}
                    {i === 0 && !filtering && <span className="text-xs font-semibold rounded-full px-2 py-0.5 bg-sun flex items-center gap-1"><Sparkles size={12} /> Top match</span>}
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
                <Button variant="ghost" onClick={() => toggle(m.userId)}>
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
      {data.limited && (
        <Card className="mt-4 flex flex-col sm:flex-row items-center gap-4 bg-sun/15 border-sun">
          <Crown className="text-amber-600 shrink-0" size={28} />
          <p className="flex-1 text-center sm:text-left">
            You are seeing your top {matches.length} of <b>{data.total} matches</b>. Get Premium to see everyone who fits you.
          </p>
          <Link to="/premium" className="px-4 py-2 rounded-xl bg-nest text-white font-semibold whitespace-nowrap">See Premium</Link>
        </Card>
      )}
      <p className="text-xs text-ink/50 mt-6 text-center">
        When you open "Why this match?" on someone, they can see that you viewed their profile.
      </p>
    </div>
  )
}

const ago = (iso) => {
  const h = Math.round((Date.now() - new Date(iso)) / 3600000)
  if (h < 1) return 'just now'
  if (h < 24) return `${h} h ago`
  return `${Math.round(h / 24)} d ago`
}

function WhoViewedCard() {
  const [v, setV] = useState(null)
  useEffect(() => { api('/profile-views').then(setV).catch(() => {}) }, [])
  if (!v) return <Card className="animate-pulse h-28" />

  return (
    <Card>
      <h3 className="font-bold flex items-center gap-2"><Eye size={18} className="text-nest" /> Who viewed your profile</h3>
      <p className="text-sm text-ink/70 mb-3">
        <b className="text-ink">{v.count}</b> {v.count === 1 ? 'person' : 'people'} in the last {v.days} days
        {v.thisWeek > 0 && <> · {v.thisWeek} this week</>}
      </p>
      {v.locked ? (
        v.count > 0 ? (
          <div className="flex items-center gap-3">
            <div className="flex -space-x-2" aria-hidden="true">
              {Array.from({ length: Math.min(v.count, 4) }).map((_, i) => (
                <div key={i} className="w-9 h-9 rounded-full bg-nest-soft ring-2 ring-white blur-[2px]" />
              ))}
            </div>
            <Link to="/premium" className="inline-flex items-center gap-1.5 text-sm font-semibold text-nest-dark underline">
              <Lock size={14} /> See who with Premium
            </Link>
          </div>
        ) : <p className="text-sm text-ink/60">Nobody yet. Complete your profile to get noticed.</p>
      ) : v.viewers.length === 0 ? (
        <p className="text-sm text-ink/60">Nobody yet.</p>
      ) : (
        <ul className="space-y-2">
          {v.viewers.slice(0, 4).map((p) => (
            <li key={p.userId} className="flex items-center gap-2">
              <Avatar name={p.name} size="sm" />
              <span className="flex-1 text-sm"><b>{p.name}</b> <span className="text-ink/50">· {ago(p.at)}</span></span>
              <Link to={`/chat/${p.userId}`} className="text-sm font-semibold text-nest-dark underline">Message</Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

function FilterCard({ locked, filters, setFilters }) {
  const [draft, setDraft] = useState(filters)
  const set = (k) => (e) => setDraft({ ...draft, [k]: e.target.value })
  const active = Object.values(filters).filter(Boolean).length

  if (locked) {
    return (
      <Card className="relative overflow-hidden">
        <h3 className="font-bold flex items-center gap-2"><SlidersHorizontal size={18} className="text-nest" /> Advanced filters</h3>
        <p className="text-sm text-ink/70 mb-3">Filter by budget, sleep time, smoking, food, language and minimum match score.</p>
        <div className="flex flex-wrap gap-2 opacity-50 select-none" aria-hidden="true">
          {['Night owl', 'Non-smoker', 'Halal', 'Score 80+'].map((x) => (
            <span key={x} className="text-xs rounded-full px-2.5 py-1 border border-black/15">{x}</span>
          ))}
        </div>
        <Link to="/premium" className="inline-flex items-center gap-1.5 mt-3 text-sm font-semibold text-nest-dark underline">
          <Lock size={14} /> Unlock with Premium
        </Link>
      </Card>
    )
  }

  return (
    <Card>
      <h3 className="font-bold flex items-center gap-2 mb-3">
        <SlidersHorizontal size={18} className="text-nest" /> Advanced filters
        {active > 0 && <span className="text-xs rounded-full px-2 py-0.5 bg-nest text-white">{active} on</span>}
      </h3>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <select className={inputClass} value={draft.sleep} onChange={set('sleep')} aria-label="Sleep time">
          <option value="">Any sleep time</option><option value="early">Early bird</option><option value="late">Night owl</option>
        </select>
        <select className={inputClass} value={draft.smoking} onChange={set('smoking')} aria-label="Smoking">
          <option value="">Any smoking</option><option value="no">Non-smoker only</option><option value="not_indoors">Doesn't smoke indoors</option>
        </select>
        <select className={inputClass} value={draft.food} onChange={set('food')} aria-label="Food">
          <option value="">Any food</option><option value="halal">Halal</option><option value="vegetarian">Vegetarian</option>
        </select>
        <select className={inputClass} value={draft.gender} onChange={set('gender')} aria-label="Gender">
          <option value="">Any gender</option><option value="female">Female</option><option value="male">Male</option><option value="other">Other</option>
        </select>
        <input className={inputClass} placeholder="Speaks (e.g. Thai)" value={draft.language} onChange={set('language')} aria-label="Language" />
        <input className={inputClass} type="number" min="0" placeholder="My max budget (THB)" value={draft.maxBudget} onChange={set('maxBudget')} aria-label="Max budget" />
        <select className={`${inputClass} col-span-2`} value={draft.minScore} onChange={set('minScore')} aria-label="Minimum score">
          <option value="">Any match score</option><option value="60">60% or higher</option><option value="70">70% or higher</option><option value="80">80% or higher</option>
        </select>
      </div>
      <div className="flex gap-2 mt-3">
        <Button onClick={() => setFilters(draft)} className="flex-1">Apply filters</Button>
        {active > 0 && (
          <Button variant="ghost" onClick={() => { setDraft(NO_FILTERS); setFilters(NO_FILTERS) }} aria-label="Clear filters"><X size={16} /> Clear</Button>
        )}
      </div>
    </Card>
  )
}
