import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, Clock, Crown, Handshake } from 'lucide-react'
import { api } from '../api'
import { Card, ErrorText, PageTitle } from '../components/ui'
import PaySlipForm from '../components/PaySlipForm'
import InviteCard from '../components/InviteCard'

const dateText = (iso) => new Date(iso).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })

export default function PremiumPage({ onChanged }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  const load = () => api('/premium').then(setData).catch((e) => setError(e.message))
  useEffect(() => { load() }, [])

  if (error && !data) return <ErrorText>{error}</ErrorText>
  if (!data) return <p>Loading...</p>

  const latest = data.payments[0]
  const benefits = [
    `See all your roommate matches (free accounts see the top ${data.freeMatchLimit})`,
    'Advanced match filters: budget, sleep time, smoking, food, language and minimum score',
    'See who viewed your profile, and message them first',
    'Early access: see newly verified rooms 24 hours before everyone else',
    'Premium badge on your profile, so others know you are serious',
    `Valid for ${data.plan.days} days, about one semester`,
  ]

  return (
    <div className="max-w-4xl mx-auto">
      <PageTitle title="UniNest Premium" subtitle="One payment for the whole semester. No subscription." />

      {data.isPremium ? (
        <Card className="text-center py-10">
          <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-sun grid place-items-center"><Crown size={30} /></div>
          <h3 className="text-xl font-bold">You have Premium</h3>
          <p className="text-ink/70 mb-4">Your {data.plan.name} is active until <b>{dateText(data.premiumUntil)}</b>.</p>
          <Link to="/matches" className="inline-block px-4 py-2 rounded-xl bg-nest text-white font-semibold">See all my matches</Link>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 gap-5">
          <PlanCard plan={data.plan} benefits={benefits} />
          {latest?.status === 'pending'
            ? <PendingCard payment={latest} />
            : (
              <Card>
                <PaySlipForm
                  amount={data.plan.amount}
                  qr={data.qr}
                  testMode={data.testMode}
                  payTo={data.payTo}
                  postTo="/premium/payments"
                  lastRejected={latest?.status === 'rejected' ? latest : null}
                  onUploaded={() => { load(); onChanged?.() }}
                />
              </Card>
            )}
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-5 mt-5 [&>*]:min-w-0">
        <InviteCard />
        <PerksCard isPremium={data.isPremium} />
      </div>

      {data.payments.length > 0 && <History payments={data.payments} />}
    </div>
  )
}

function PlanCard({ plan, benefits }) {
  return (
    <Card className="bg-gradient-to-br from-nest to-nest-dark text-white border-0 relative overflow-hidden">
      <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-white/10" />
      <p className="flex items-center gap-2 font-semibold text-sun relative"><Crown size={18} /> {plan.name}</p>
      <p className="text-5xl font-bold my-3 relative">{plan.amount} <span className="text-xl font-semibold">THB</span></p>
      <p className="text-white/80 mb-4 relative">One-time payment</p>
      <ul className="space-y-2.5 relative">
        {benefits.map((b) => (
          <li key={b} className="flex gap-2"><CheckCircle2 size={20} className="shrink-0 text-sun" /> {b}</li>
        ))}
      </ul>
    </Card>
  )
}

// Partner offers are planned, not live yet, so they are clearly marked "coming soon".
function PerksCard({ isPremium }) {
  return (
    <Card>
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-full bg-nest-soft text-nest grid place-items-center shrink-0"><Handshake size={22} /></div>
        <div>
          <h3 className="font-bold flex items-center gap-2">Partner perks <span className="text-xs font-semibold rounded-full px-2 py-0.5 bg-cream border border-black/10">Coming soon</span></h3>
          <p className="text-sm text-ink/70 mb-2">We are talking to partners so {isPremium ? 'you' : 'Premium students'} can save on student life:</p>
          <ul className="text-sm space-y-1 list-disc pl-5">
            <li>Discounts at restaurants and cafes near campus</li>
            <li>Cheaper ride-hailing trips during your first 2 months</li>
          </ul>
          <p className="text-xs text-ink/60 mt-2">These offers are not available yet. We will announce partners here.</p>
        </div>
      </div>
    </Card>
  )
}

function PendingCard({ payment }) {
  return (
    <Card className="text-center flex flex-col justify-center py-10">
      <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-sun/30 grid place-items-center"><Clock size={26} /></div>
      <h3 className="text-lg font-bold">We are checking your slip</h3>
      <p className="text-ink/70">Sent on {dateText(payment.createdAt)}. Premium turns on as soon as it is approved, usually within a day.</p>
    </Card>
  )
}

const STATUS = {
  pending: { label: 'Checking', cls: 'bg-sun/30 text-ink' },
  approved: { label: 'Approved', cls: 'bg-nest text-white' },
  rejected: { label: 'Not accepted', cls: 'bg-red-100 text-red-800' },
}

function History({ payments }) {
  return (
    <div className="mt-6">
      <h3 className="font-bold mb-2">Your payments</h3>
      <Card className="!p-0 divide-y divide-black/5">
        {payments.map((p) => (
          <div key={p.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
            <span>{dateText(p.createdAt)}</span>
            <span>{p.amount} THB</span>
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS[p.status].cls}`}>{STATUS[p.status].label}</span>
          </div>
        ))}
      </Card>
    </div>
  )
}
