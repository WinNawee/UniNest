import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BedDouble, ChevronDown, Crown, MapPin, MessageCircle, ShieldCheck, Sparkles, Zap } from 'lucide-react'
import { api } from '../api'
import { Button, Card, ErrorText, Field, PageTitle, inputClass } from '../components/ui'
import Stars from '../components/Stars'
import PhotoGallery from '../components/PhotoGallery'

export default function ListingsPage({ me }) {
  const [filters, setFilters] = useState({ maxPrice: '', type: '', maxDistance: '' })
  const [data, setData] = useState(null)
  const [open, setOpen] = useState(null)
  const [error, setError] = useState('')
  const set = (k) => (e) => setFilters({ ...filters, [k]: e.target.value })

  const load = () => {
    const qs = new URLSearchParams(Object.entries(filters).filter(([, v]) => v)).toString()
    return api('/listings' + (qs ? `?${qs}` : '')).then(setData).catch((e) => setError(e.message))
  }
  useEffect(() => { load() }, [filters]) // eslint-disable-line react-hooks/exhaustive-deps

  const rows = data?.listings

  return (
    <div>
      <PageTitle title="Verified housing" subtitle="Every listing here has been checked by the UniNest team." />
      <Card className="mb-5 grid sm:grid-cols-3 gap-x-4">
        <Field label="Max price (THB per month)">
          <input type="number" className={inputClass} value={filters.maxPrice} onChange={set('maxPrice')} />
        </Field>
        <Field label="Type">
          <select className={inputClass} value={filters.type} onChange={set('type')}>
            <option value="">Any</option>
            <option value="dorm">Dorm</option>
            <option value="condo">Condo</option>
            <option value="apartment">Apartment</option>
          </select>
        </Field>
        <Field label="Max distance (km)">
          <input type="number" step="0.1" className={inputClass} value={filters.maxDistance} onChange={set('maxDistance')} />
        </Field>
      </Card>

      {data?.earlyAccessHidden > 0 && (
        <Card className="mb-5 flex flex-col sm:flex-row items-center gap-4 bg-sun/15 border-sun">
          <Zap className="text-amber-600 shrink-0" size={26} />
          <p className="flex-1 text-center sm:text-left">
            <b>{data.earlyAccessHidden} new {data.earlyAccessHidden === 1 ? 'room was' : 'rooms were'} verified today.</b> Premium students see new rooms 24 hours before everyone else.
          </p>
          <Link to="/premium" className="px-4 py-2 rounded-xl bg-nest text-white font-semibold whitespace-nowrap">See Premium</Link>
        </Card>
      )}

      <ErrorText>{error}</ErrorText>
      {!rows ? <p>Loading...</p> : rows.length === 0 ? <Card>No listings match these filters.</Card> : (
        <div className="grid sm:grid-cols-2 gap-4 items-start">
          {rows.map((l) => (
            <Card key={l.id} className={`transition hover:shadow-md ${l.featured ? 'ring-2 ring-sun' : ''}`}>
              <PhotoGallery photoIds={l.photoIds} title={l.title} />
              <div className="flex flex-wrap gap-1.5 mb-2">
                {l.sample && <span className="text-xs font-semibold rounded-full px-2 py-0.5 bg-black/5 text-ink/70">Sample listing</span>}
                {l.featured && <span className="text-xs font-semibold rounded-full px-2 py-0.5 bg-sun flex items-center gap-1"><Sparkles size={12} /> Featured</span>}
                {l.isNew && <span className="text-xs font-semibold rounded-full px-2 py-0.5 bg-amber-100 text-amber-900 flex items-center gap-1"><Crown size={12} /> New · Premium early access</span>}
                <span className="text-xs bg-nest text-white rounded-full px-2 py-0.5 flex items-center gap-1"><ShieldCheck size={12} /> Verified</span>
              </div>
              <h3 className="font-bold">{l.title}</h3>
              <p className="text-2xl font-bold text-nest my-1">{l.price.toLocaleString()} THB<span className="text-sm font-normal text-ink/60"> / month</span></p>
              <p className="text-sm text-ink/70 flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="capitalize">{l.type}</span>
                <span className="flex items-center gap-1"><BedDouble size={14} /> {l.beds} bed{l.beds > 1 ? 's' : ''}</span>
                <span className="flex items-center gap-1"><MapPin size={14} /> {l.distanceKm} km from campus</span>
              </p>
              <div className="flex flex-wrap gap-1 mt-3">
                {l.amenities.map((a) => <span key={a} className="text-xs bg-nest-soft rounded-full px-2 py-0.5">{a}</span>)}
              </div>
              {me.role === 'student' && !l.sample && (
                <Link
                  to={`/chat/${l.ownerId}?about=${encodeURIComponent(l.title)}`}
                  className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl font-semibold bg-nest text-white hover:bg-nest-dark shadow-sm shadow-nest/20"
                >
                  <MessageCircle size={16} /> Message landlord
                </Link>
              )}
              <button
                onClick={() => setOpen(open === l.id ? null : l.id)}
                className="w-full flex items-center justify-between gap-2 mt-4 pt-3 border-t border-black/5 text-sm"
              >
                <span className="flex items-center gap-2">
                  <Stars value={l.rating || 0} />
                  {l.reviewCount > 0 ? <span><b>{l.rating}</b> · {l.reviewCount} review{l.reviewCount > 1 ? 's' : ''}</span> : <span className="text-ink/60">No reviews yet</span>}
                </span>
                <ChevronDown size={16} className={`transition ${open === l.id ? 'rotate-180' : ''}`} />
              </button>
              {open === l.id && <Reviews listingId={l.id} canReview={me.role === 'student'} onChanged={load} />}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

const dateText = (iso) => new Date(iso).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })

function Reviews({ listingId, canReview, onChanged }) {
  const [data, setData] = useState(null)
  const [rating, setRating] = useState(0)
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const [saved, setSaved] = useState('')

  const load = () => api(`/listings/${listingId}/reviews`).then((d) => {
    setData(d)
    const mine = d.reviews.find((r) => r.mine)
    if (mine) { setRating(mine.rating); setText(mine.text || '') }
  })
  useEffect(() => { load() }, [listingId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function submit(e) {
    e.preventDefault()
    setError('')
    setSaved('')
    try {
      const r = await api(`/listings/${listingId}/reviews`, { method: 'POST', body: { rating, text } })
      setSaved(r.updated ? 'Your review was updated.' : 'Thanks for your review.')
      await load()
      onChanged()
    } catch (err) {
      setError(err.message)
    }
  }

  if (!data) return <p className="text-sm mt-3">Loading reviews...</p>
  const hasMine = data.reviews.some((r) => r.mine)

  return (
    <div className="mt-3 space-y-3">
      {data.reviews.map((r) => (
        <div key={r.id} className="bg-cream rounded-xl p-3">
          <div className="flex items-center justify-between gap-2 text-sm">
            <span><b>{r.author}</b>{r.mine && <span className="text-ink/50"> (you)</span>}</span>
            <Stars value={r.rating} size={14} />
          </div>
          {r.text && <p className="text-sm mt-1">{r.text}</p>}
          <p className="text-xs text-ink/50 mt-1">{dateText(r.at)}</p>
        </div>
      ))}
      {canReview && (
        <form onSubmit={submit} className="border border-black/10 rounded-xl p-3">
          <p className="text-sm font-semibold mb-1">{hasMine ? 'Edit your review' : 'Lived here? Write a review'}</p>
          <Stars value={rating} size={22} onPick={setRating} />
          <textarea
            className={`${inputClass} mt-2 text-sm`}
            rows={2}
            maxLength={500}
            placeholder="What was it like? (optional)"
            value={text}
            onChange={(e) => setText(e.target.value)}
            aria-label="Review text"
          />
          <ErrorText>{error}</ErrorText>
          {saved && <p className="text-sm text-nest-dark mb-2">{saved}</p>}
          <Button disabled={!rating} className="mt-1">{hasMine ? 'Update review' : 'Post review'}</Button>
        </form>
      )}
    </div>
  )
}
