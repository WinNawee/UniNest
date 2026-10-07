import { useEffect, useState } from 'react'
import { api } from '../api'
import { Button, Card, ErrorText, Field, inputClass } from '../components/ui'

const EMPTY = { title: '', type: 'dorm', price: '', beds: 1, distanceKm: '', amenities: '', campus: 'AIT' }

export default function LandlordPage() {
  const [rows, setRows] = useState([])
  const [form, setForm] = useState(EMPTY)
  const [error, setError] = useState('')
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })
  const load = () => api('/listings/mine').then((d) => setRows(d.listings))
  useEffect(() => { load() }, [])

  async function submit(e) {
    e.preventDefault()
    setError('')
    try {
      await api('/listings', {
        method: 'POST',
        body: {
          ...form,
          price: Number(form.price),
          beds: Number(form.beds),
          distanceKm: Number(form.distanceKm),
          amenities: form.amenities.split(',').map((s) => s.trim()).filter(Boolean),
        },
      })
      setForm(EMPTY)
      load()
    } catch (err) {
      setError(err.message)
    }
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
          <ErrorText>{error}</ErrorText>
          <Button>Submit for checking</Button>
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
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
