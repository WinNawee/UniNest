import { useEffect, useState } from 'react'
import { Clock, ImagePlus, Sparkles, X } from 'lucide-react'
import { api, photoUrl } from '../api'
import { compressImage } from '../image'
import { Button, Card, ErrorText, Field, inputClass } from '../components/ui'
import PaySlipForm from '../components/PaySlipForm'

const dateText = (iso) => new Date(iso).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })

const EMPTY = { title: '', type: 'dorm', price: '', beds: 1, distanceKm: '', amenities: '', campus: 'AIT' }
const MAX_PHOTOS = 6

// Shrinks each photo in the browser, then uploads them one by one.
async function uploadPhotos(listingId, files, onProgress = () => {}) {
  for (let i = 0; i < files.length; i++) {
    onProgress(i + 1, files.length)
    const photo = await compressImage(files[i], 1280, 0.75)
    await api(`/listings/${listingId}/photos`, { method: 'POST', body: { photo } })
  }
}

export default function LandlordPage() {
  const [rows, setRows] = useState([])
  const [form, setForm] = useState(EMPTY)
  const [error, setError] = useState('')
  const [files, setFiles] = useState([]) // photos chosen for the new room: { file, preview }
  const [busy, setBusy] = useState('')
  const [featuring, setFeaturing] = useState(null) // listing id with the payment window open
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })
  const load = () => api('/listings/mine').then((d) => setRows(d.listings))
  useEffect(() => { load() }, [])

  async function submit(e) {
    e.preventDefault()
    setError('')
    setBusy('Saving...')
    try {
      const { listing } = await api('/listings', {
        method: 'POST',
        body: {
          ...form,
          price: Number(form.price),
          beds: Number(form.beds),
          distanceKm: Number(form.distanceKm),
          amenities: form.amenities.split(',').map((s) => s.trim()).filter(Boolean),
        },
      })
      await uploadPhotos(listing.id, files.map((f) => f.file), (n, total) => setBusy(`Uploading photo ${n} of ${total}...`))
      setForm(EMPTY)
      setFiles([])
      load()
    } catch (err) {
      setError(err.message)
      load()
    } finally {
      setBusy('')
    }
  }

  function choosePhotos(e) {
    const added = [...e.target.files].map((file) => ({ file, preview: URL.createObjectURL(file) }))
    setFiles([...files, ...added].slice(0, MAX_PHOTOS))
    e.target.value = ''
  }

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <form onSubmit={submit}>
        <h2 className="text-2xl font-bold mb-3">Add a room</h2>
        <Card>
          <Field label="Title"><input className={inputClass} value={form.title} onChange={set('title')} required /></Field>
          <Field label="Type">
            <select className={inputClass} value={form.type} onChange={set('type')}>
              <option value="dorm">Dorm</option><option value="condo">Condo</option><option value="apartment">Apartment</option>
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-x-3">
            <Field label="Price (THB per month)"><input type="number" className={inputClass} value={form.price} onChange={set('price')} required /></Field>
            <Field label="Beds"><input type="number" min="1" className={inputClass} value={form.beds} onChange={set('beds')} required /></Field>
            <Field label="Distance (km)"><input type="number" step="0.1" className={inputClass} value={form.distanceKm} onChange={set('distanceKm')} /></Field>
            <Field label="University"><input className={inputClass} value={form.campus} onChange={set('campus')} /></Field>
          </div>
          <Field label="Amenities" hint="Separate with commas"><input className={inputClass} value={form.amenities} onChange={set('amenities')} /></Field>
          <Field label={`Photos (up to ${MAX_PHOTOS})`} hint="Real photos of the room. The first one is the cover.">
            <div className="flex flex-wrap gap-2">
              {files.map((f, i) => (
                <div key={i} className="relative">
                  <img src={f.preview} alt="" className="w-20 h-14 object-cover rounded-lg border border-black/10" />
                  <button type="button" onClick={() => setFiles(files.filter((_, j) => j !== i))} className="absolute -top-2 -right-2 w-6 h-6 grid place-items-center rounded-full bg-white shadow" aria-label="Remove photo"><X size={13} /></button>
                </div>
              ))}
              {files.length < MAX_PHOTOS && <PhotoPicker onChange={choosePhotos} />}
            </div>
          </Field>
          <ErrorText>{error}</ErrorText>
          <Button disabled={Boolean(busy)}>{busy || 'Submit for checking'}</Button>
        </Card>
      </form>
      <div>
        <h2 className="text-2xl font-bold mb-3">Your listings</h2>
        <div className="grid gap-3">
          {rows.length === 0 && <Card>No listings yet.</Card>}
          {rows.map((l) => (
            <Card key={l.id}>
              <div className="flex justify-between gap-2">
                <h3 className="font-bold">{l.title}</h3>
                <span className={`text-xs rounded-full px-2 py-0.5 h-fit ${l.verified ? 'bg-nest text-white' : 'bg-sun'}`}>
                  {l.verified ? 'Verified' : 'Waiting for check'}
                </span>
              </div>
              <p className="text-sm">{l.price.toLocaleString()} THB per month · {l.type}</p>
              <RoomPhotos listing={l} onChanged={load} />
              <div className="mt-3 pt-3 border-t border-black/5 text-sm">
                {l.featured ? (
                  <p className="flex items-center gap-1.5 font-semibold"><Sparkles size={15} className="text-amber-500" /> Featured until {dateText(l.featuredUntil)}</p>
                ) : l.featurePending ? (
                  <p className="flex items-center gap-1.5 text-ink/70"><Clock size={15} /> Featured Listing payment is being checked</p>
                ) : l.verified ? (
                  <button onClick={() => setFeaturing(l.id)} className="inline-flex items-center gap-1.5 font-semibold text-nest-dark underline">
                    <Sparkles size={15} /> Feature this room: show it first to students
                  </button>
                ) : (
                  <p className="text-ink/60">You can feature this room after it is verified.</p>
                )}
              </div>
            </Card>
          ))}
        </div>
      </div>
      {featuring && <FeatureDialog listingId={featuring} onClose={() => setFeaturing(null)} onDone={() => { setFeaturing(null); load() }} />}
    </div>
  )
}

function PhotoPicker({ onChange }) {
  return (
    <label className="w-20 h-14 grid place-items-center rounded-lg border-2 border-dashed border-nest/30 text-nest cursor-pointer hover:bg-nest-soft" title="Add photos">
      <ImagePlus size={20} />
      <input type="file" accept="image/*" multiple onChange={onChange} className="sr-only" aria-label="Add photos" />
    </label>
  )
}

// Photos of a room the landlord already added: remove one, or add more.
function RoomPhotos({ listing, onChanged }) {
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const ids = listing.photoIds

  async function add(e) {
    const chosen = [...e.target.files].slice(0, MAX_PHOTOS - ids.length)
    e.target.value = ''
    setError('')
    try {
      await uploadPhotos(listing.id, chosen, (n, total) => setBusy(`Uploading ${n} of ${total}...`))
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy('')
      onChanged()
    }
  }

  async function remove(photoId) {
    await api(`/listings/${listing.id}/photos/${photoId}`, { method: 'DELETE' })
    onChanged()
  }

  return (
    <div className="mt-3">
      <div className="flex flex-wrap gap-2">
        {ids.map((id) => (
          <div key={id} className="relative">
            <img src={photoUrl(id)} alt="" className="w-20 h-14 object-cover rounded-lg border border-black/10" />
            <button onClick={() => remove(id)} className="absolute -top-2 -right-2 w-6 h-6 grid place-items-center rounded-full bg-white shadow" aria-label="Delete photo"><X size={13} /></button>
          </div>
        ))}
        {ids.length < MAX_PHOTOS && !busy && <PhotoPicker onChange={add} />}
      </div>
      {ids.length === 0 && !busy && <p className="text-xs text-ink/60 mt-1">Rooms with photos get more messages from students.</p>}
      {busy && <p className="text-xs text-ink/60 mt-1">{busy}</p>}
      <ErrorText>{error}</ErrorText>
    </div>
  )
}

// Pay for a Featured Listing with the same PromptPay QR + slip check as Premium.
function FeatureDialog({ listingId, onClose, onDone }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => { api(`/featured/${listingId}`).then(setData).catch((e) => setError(e.message)) }, [listingId])
  const latest = data?.payments[0]

  return (
    <div className="fixed inset-0 z-50 bg-black/50 grid place-items-center p-4 overflow-y-auto" role="dialog" aria-modal="true" aria-label="Feature this room">
      <Card className="w-full max-w-md relative my-8">
        <button onClick={onClose} className="absolute top-3 right-3 p-1.5 rounded-lg hover:bg-cream" aria-label="Close"><X size={18} /></button>
        <ErrorText>{error}</ErrorText>
        {!data ? <p>Loading...</p> : (
          <>
            <p className="flex items-center gap-2 font-semibold text-amber-700"><Sparkles size={18} /> {data.plan.name}</p>
            <h2 className="text-xl font-bold mb-1">{data.listing.title}</h2>
            <p className="text-sm text-ink/70 mb-4">
              <b>{data.plan.amount} THB for {data.plan.days} days.</b> Your room is shown at the top of Housing with a Featured badge, so more students see it first.
            </p>
            <PaySlipForm
              amount={data.plan.amount}
              qr={data.qr}
              testMode={data.testMode}
              payTo={data.payTo}
              postTo={`/featured/${listingId}/payments`}
              lastRejected={latest?.status === 'rejected' ? latest : null}
              onUploaded={onDone}
            />
          </>
        )}
      </Card>
    </div>
  )
}
