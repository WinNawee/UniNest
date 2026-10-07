import { useEffect, useState } from 'react'
import { api } from '../api'
import { Button, Card } from '../components/ui'

export default function AdminPage() {
  const [rows, setRows] = useState(null)
  const load = () => api('/admin/listings/pending').then((d) => setRows(d.listings))
  useEffect(() => { load() }, [])

  async function verify(id) {
    await api(`/admin/listings/${id}/verify`, { method: 'PUT' })
    load()
  }

  return (
    <div>
      <h2 className="text-2xl font-bold mb-3">Listings waiting for a check</h2>
      {!rows ? <p>Loading...</p> : rows.length === 0 ? <Card>Nothing waiting.</Card> : (
        <div className="grid gap-3">
          {rows.map((l) => (
            <Card key={l.id} className="flex items-center justify-between gap-3">
              <div>
                <h3 className="font-bold">{l.title}</h3>
                <p className="text-sm">{l.price.toLocaleString()} THB per month · {l.type} · {l.campus}</p>
              </div>
              <Button onClick={() => verify(l.id)}>Mark as verified</Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
