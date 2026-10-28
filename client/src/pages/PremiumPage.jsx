import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, Clock, Crown, ImageUp, TriangleAlert, XCircle } from 'lucide-react'
import { api } from '../api'
import { compressImage } from '../image'
import { Button, Card, ErrorText, PageTitle } from '../components/ui'

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
            : <PayCard data={data} latest={latest} onUploaded={() => { load(); onChanged?.() }} />}
        </div>
      )}

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

function PayCard({ data, latest, onUploaded }) {
  const [slip, setSlip] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function choose(e) {
    setError('')
    const file = e.target.files?.[0]
    if (!file) return
    try {
      setSlip(await compressImage(file))
    } catch (err) {
      setError(err.message)
    }
  }

  async function submit() {
    setBusy(true)
    setError('')
    try {
      await api('/premium/payments', { method: 'POST', body: { slip } })
      onUploaded()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      {latest?.status === 'rejected' && (
        <div className="flex gap-2 bg-red-50 text-red-800 rounded-xl p-3 mb-4 text-sm">
          <XCircle size={18} className="shrink-0" />
          <p>Your last slip was not accepted: <b>{latest.rejectReason}</b>. Please upload a new one.</p>
        </div>
      )}

      <h3 className="font-bold mb-1">1. Scan and pay with PromptPay</h3>
      <p className="text-sm text-ink/70 mb-3">Open any Thai banking app, scan the QR and check the amount is {data.plan.amount} THB.</p>
      {data.testMode && (
        <div className="flex gap-2 bg-sun/25 border border-sun rounded-xl p-2.5 mb-3 text-sm">
          <TriangleAlert size={18} className="shrink-0" />
          <p><b>Test QR. Do not pay.</b> No PromptPay number is set on this server yet.</p>
        </div>
      )}
      <div className="flex flex-col items-center bg-white border border-black/10 rounded-2xl p-4 mb-1">
        <p className="text-xs font-bold tracking-wider text-[#113566] mb-2">THAI QR PAYMENT · PROMPTPAY</p>
        <img src={data.qr} alt={`PromptPay QR for ${data.plan.amount} THB`} className={`w-52 h-52 ${data.testMode ? 'opacity-40' : ''}`} />
        <p className="font-bold text-lg mt-2">{data.plan.amount}.00 THB</p>
        {data.payTo && <p className="text-sm text-ink/70">Pay to {data.payTo}</p>}
      </div>

      <h3 className="font-bold mt-5 mb-1">2. Upload your transfer slip</h3>
      <p className="text-sm text-ink/70 mb-3">Take a screenshot of the slip in your banking app. We check it, usually within a day.</p>
      <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-nest/30 rounded-2xl p-4 cursor-pointer hover:bg-nest-soft/40 transition">
        {slip
          ? <img src={slip} alt="Your slip" className="max-h-56 rounded-lg" />
          : <><ImageUp className="text-nest" /> <span className="font-semibold">Choose slip photo</span></>}
        <input type="file" accept="image/*" onChange={choose} className="sr-only" aria-label="Slip photo" />
      </label>
      {slip && <p className="text-xs text-ink/60 mt-1 text-center">Tap the image to choose a different one.</p>}
      <div className="mt-3"><ErrorText>{error}</ErrorText></div>
      <Button onClick={submit} disabled={!slip || busy} className="w-full mt-1">{busy ? 'Sending...' : 'Send slip for checking'}</Button>
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
