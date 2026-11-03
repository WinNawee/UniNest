import { useEffect, useState } from 'react'
import { api } from '../api'
import { Card } from './ui'

// Business dashboard: e-metrics for the admin.
// One green for all bars (each chart shows a single measure), numbers always written next to bars.

const fmt = (n) => Number(n || 0).toLocaleString()
const shortDay = (key) => new Date(`${key}T00:00:00`).toLocaleDateString([], { day: 'numeric', month: 'short' })

export default function Dashboard() {
  const [includeDemo, setIncludeDemo] = useState(false)
  const [s, setS] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    setS(null)
    api(`/admin/stats${includeDemo ? '?includeDemo=1' : ''}`).then(setS).catch((e) => setError(e.message))
  }, [includeDemo])

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-2xl font-bold">Business dashboard</h2>
          <p className="text-sm text-ink/70">{includeDemo ? 'Including demo accounts.' : 'Real users only (demo accounts are left out).'}</p>
        </div>
        <label className="flex items-center gap-2 text-sm font-semibold cursor-pointer">
          <input type="checkbox" checked={includeDemo} onChange={(e) => setIncludeDemo(e.target.checked)} className="w-4 h-4 accent-nest" />
          Include demo accounts
        </label>
      </div>
      {error && <p className="text-red-700">{error}</p>}
      {!s ? <p>Loading...</p> : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Tile label="Students" value={fmt(s.users.students)} note={`${fmt(s.users.landlords)} landlords`} />
            <Tile label="Paid conversion" value={`${s.conversionRate}%`} note="of students paid for Premium" />
            <Tile label="Revenue" value={`${fmt(s.revenue.total)} THB`} note={`${s.revenue.premiumCount + s.revenue.featuredCount} approved payments`} />
            <Tile label="Premium right now" value={fmt(s.users.premiumNow)} note="paid or invite reward" />
            <Tile label="Verified rooms" value={fmt(s.listings.verified)} note={`${fmt(s.listings.waiting)} waiting for check`} />
            <Tile label="Featured rooms" value={fmt(s.listings.featuredNow)} note="paid boost active" />
            <Tile label="Room reviews" value={fmt(s.reviews.count)} note={s.reviews.average ? `average ${s.reviews.average} of 5` : 'no ratings yet'} />
            <Tile label="Joined by invite" value={fmt(s.referrals.friendsJoined)} note="referral program" />
          </div>

          <div className="grid lg:grid-cols-2 gap-5">
            <Card>
              <h3 className="font-bold">Student journey (funnel)</h3>
              <p className="text-sm text-ink/70 mb-4">How many students reach each step. The percentage is of everyone who signed up.</p>
              <Funnel steps={s.funnel} />
            </Card>
            <Card>
              <h3 className="font-bold">Revenue by stream</h3>
              <p className="text-sm text-ink/70 mb-4">Students pay for Premium, landlords pay for Featured Listings.</p>
              <HBars
                rows={[
                  { label: 'Premium (students)', value: s.revenue.premium, note: `${s.revenue.premiumCount} × ${s.revenue.premiumCount ? Math.round(s.revenue.premium / s.revenue.premiumCount) : 0} THB` },
                  { label: 'Featured (landlords)', value: s.revenue.featured, note: `${s.revenue.featuredCount} × ${s.revenue.featuredCount ? Math.round(s.revenue.featured / s.revenue.featuredCount) : 0} THB` },
                ]}
                unit=" THB"
              />
              {s.revenue.pendingSlips > 0 && <p className="text-sm text-ink/70 mt-3">{s.revenue.pendingSlips} slip(s) waiting for a check are not counted yet.</p>}
            </Card>
          </div>

          <Card>
            <h3 className="font-bold">New sign-ups per day</h3>
            <p className="text-sm text-ink/70 mb-4">Last 14 days, students and landlords. Hover a bar for the exact number.</p>
            <DailyBars days={s.signups} />
          </Card>
        </div>
      )}
    </div>
  )
}

function Tile({ label, value, note }) {
  return (
    <Card className="!p-4">
      <p className="text-xs font-semibold text-ink/60 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
      {note && <p className="text-xs text-ink/60 mt-0.5">{note}</p>}
    </Card>
  )
}

function Funnel({ steps }) {
  const max = Math.max(1, steps[0]?.count || 0)
  return (
    <ol className="space-y-3">
      {steps.map((st, i) => (
        <li key={st.label} className="group relative">
          <div className="flex justify-between text-sm mb-1">
            <span>{i + 1}. {st.label}</span>
            <span><b>{fmt(st.count)}</b> <span className="text-ink/60">· {st.ofSignups}%</span></span>
          </div>
          <div className="h-3 bg-black/5 rounded-r">
            <div className="h-full bg-nest rounded-r transition-all" style={{ width: `${(st.count / max) * 100}%`, minWidth: st.count ? 4 : 0 }} />
          </div>
          {i > 0 && <p className="text-xs text-ink/50 mt-0.5">{st.fromPrevious}% of the step before</p>}
        </li>
      ))}
    </ol>
  )
}

function HBars({ rows, unit = '' }) {
  const max = Math.max(1, ...rows.map((r) => r.value))
  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <div key={r.label}>
          <div className="flex justify-between text-sm mb-1">
            <span>{r.label}</span>
            <span><b>{fmt(r.value)}{unit}</b> <span className="text-ink/60">· {r.note}</span></span>
          </div>
          <div className="h-3 bg-black/5 rounded-r">
            <div className="h-full bg-nest rounded-r" style={{ width: `${(r.value / max) * 100}%`, minWidth: r.value ? 4 : 0 }} />
          </div>
        </div>
      ))}
    </div>
  )
}

function DailyBars({ days }) {
  const max = Math.max(1, ...days.map((d) => d.count))
  const peak = days.reduce((best, d) => (d.count > best.count ? d : best), days[0])
  return (
    <div>
      <div className="relative h-40 flex items-end gap-[2px] border-b border-black/15" role="img" aria-label="New sign-ups per day, last 14 days">
        {days.map((d) => (
          <div key={d.day} className="group relative flex-1 h-full flex items-end justify-center">
            <div
              className="w-full max-w-8 bg-nest rounded-t group-hover:bg-nest-dark"
              style={{ height: `${(d.count / max) * 100}%`, minHeight: d.count ? 4 : 0 }}
            />
            {d === peak && d.count > 0 && (
              <span className="absolute text-xs font-semibold" style={{ bottom: `calc(${(d.count / max) * 100}% + 4px)` }}>{d.count}</span>
            )}
            <span className="pointer-events-none absolute bottom-full mb-1 hidden group-hover:block whitespace-nowrap rounded-lg bg-ink text-white text-xs px-2 py-1 z-10">
              {shortDay(d.day)}: <b>{d.count}</b> sign-up{d.count === 1 ? '' : 's'}
            </span>
          </div>
        ))}
      </div>
      <div className="flex justify-between text-xs text-ink/60 mt-1">
        <span>{shortDay(days[0].day)}</span>
        <span>{shortDay(days[7].day)}</span>
        <span>{shortDay(days.at(-1).day)}</span>
      </div>
    </div>
  )
}
