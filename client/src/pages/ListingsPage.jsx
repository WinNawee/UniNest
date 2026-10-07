import { useEffect, useState } from 'react'
import { api } from '../api'
import { BedDouble, MapPin, ShieldCheck } from 'lucide-react'
import { Card, ErrorText, Field, PageTitle, inputClass } from '../components/ui'

export default function ListingsPage() {
  const [filters, setFilters] = useState({ maxPrice: '', type: '', maxDistance: '' })
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')
  const set = (k) => (e) => setFilters({ ...filters, [k]: e.target.value })

  useEffect(() => {
    const qs = new URLSearchParams(Object.entries(filters).filter(([, v]) => v)).toString()
    api('/listings' + (qs ? `?${qs}` : '')).then((d) => setRows(d.listings)).catch((e) => setError(e.message))
  }, [filters])

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
      <ErrorText>{error}</ErrorText>
      {!rows ? <p>Loading...</p> : rows.length === 0 ? <Card>No listings match these filters.</Card> : (
        <div className="grid sm:grid-cols-2 gap-4">
          {rows.map((l) => (
            <Card key={l.id} className="transition hover:shadow-md hover:-translate-y-0.5">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-bold">{l.title}</h3>
                <span className="text-xs bg-nest text-white rounded-full px-2 py-0.5 whitespace-nowrap flex items-center gap-1"><ShieldCheck size={12} /> Verified</span>
              </div>
              <p className="text-2xl font-bold text-nest my-1">{l.price.toLocaleString()} THB<span className="text-sm font-normal text-ink/60"> / month</span></p>
              <p className="text-sm text-ink/70 flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="capitalize">{l.type}</span>
                <span className="flex items-center gap-1"><BedDouble size={14} /> {l.beds} bed{l.beds > 1 ? 's' : ''}</span>
                <span className="flex items-center gap-1"><MapPin size={14} /> {l.distanceKm} km from campus</span>
              </p>
              <div className="flex flex-wrap gap-1 mt-3">
                {l.amenities.map((a) => <span key={a} className="text-xs bg-nest-soft rounded-full px-2 py-0.5">{a}</span>)}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
