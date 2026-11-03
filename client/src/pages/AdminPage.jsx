import { useEffect, useState } from 'react'
import { BarChart3, Building2, Receipt, X } from 'lucide-react'
import { api, photoUrl } from '../api'
import { Button, Card, ErrorText, inputClass } from '../components/ui'
import Dashboard from '../components/Dashboard'

export default function AdminPage() {
  const [tab, setTab] = useState('dashboard')
  const tabClass = (t) =>
    `flex items-center gap-2 px-4 py-2 rounded-xl font-semibold ${tab === t ? 'bg-nest text-white' : 'bg-white border border-black/10 hover:bg-nest-soft'}`
  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-5">
        <button className={tabClass('dashboard')} onClick={() => setTab('dashboard')}><BarChart3 size={16} /> Dashboard</button>
        <button className={tabClass('payments')} onClick={() => setTab('payments')}><Receipt size={16} /> Payments</button>
        <button className={tabClass('listings')} onClick={() => setTab('listings')}><Building2 size={16} /> Listings</button>
      </div>
      {tab === 'dashboard' && <Dashboard />}
      {tab === 'payments' && <PaymentsTab />}
      {tab === 'listings' && <ListingsTab />}
    </div>
  )
}

function ListingsTab() {
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
            <Card key={l.id}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-bold">{l.title}</h3>
                  <p className="text-sm">{l.price.toLocaleString()} THB per month · {l.type} · {l.campus}</p>
                </div>
                <Button onClick={() => verify(l.id)}>Mark as verified</Button>
              </div>
              {l.photoIds.length > 0 ? (
                <div className="flex flex-wrap gap-2 mt-3">
                  {l.photoIds.map((id) => (
                    <a key={id} href={photoUrl(id)} target="_blank" rel="noreferrer">
                      <img src={photoUrl(id)} alt="" className="w-24 h-16 object-cover rounded-lg border border-black/10" />
                    </a>
                  ))}
                </div>
              ) : <p className="text-sm text-ink/50 mt-2">No photos.</p>}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

const when = (iso) => new Date(iso).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

function PaymentsTab() {
  const [status, setStatus] = useState('pending')
  const [rows, setRows] = useState(null)
  const [zoom, setZoom] = useState(null)
  const load = () => api(`/admin/payments?status=${status}`).then((d) => setRows(d.payments))
  useEffect(() => { setRows(null); load() }, [status]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <h2 className="text-2xl font-bold">Payments to check</h2>
        <select className={`${inputClass} !w-auto`} value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Show">
          <option value="pending">Waiting for check</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>
      <p className="text-sm text-ink/70 mb-4">Compare each slip with your bank app: amount, date and that the money arrived. Then approve or reject.</p>
      {!rows ? <p>Loading...</p> : rows.length === 0 ? <Card>Nothing here.</Card> : (
        <div className="grid gap-3">
          {rows.map((p) => <PaymentRow key={p.id} p={p} onZoom={setZoom} onDone={load} />)}
        </div>
      )}
      {zoom && (
        <div className="fixed inset-0 z-50 bg-black/70 grid place-items-center p-4" onClick={() => setZoom(null)}>
          <button className="absolute top-4 right-4 text-white" aria-label="Close"><X size={28} /></button>
          <img src={zoom} alt="Slip full size" className="max-h-[90vh] max-w-full rounded-xl" />
        </div>
      )}
    </div>
  )
}

function PaymentRow({ p, onZoom, onDone }) {
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function act(path, body) {
    setBusy(true)
    setError('')
    try {
      await api(`/admin/payments/${p.id}/${path}`, { method: 'PUT', body })
      onDone()
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <Card className="flex flex-col sm:flex-row gap-4">
      <button onClick={() => onZoom(p.slip)} className="shrink-0" aria-label="View slip full size">
        <img src={p.slip} alt="Slip" className="w-28 h-36 object-cover object-top rounded-lg border border-black/10" />
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-bold">{p.user.name}</p>
          <span className={`text-xs font-semibold rounded-full px-2 py-0.5 ${p.type === 'featured' ? 'bg-sun' : 'bg-amber-100 text-amber-900'}`}>
            {p.type === 'featured' ? 'Featured Listing' : 'Premium'}
          </span>
        </div>
        <p className="text-sm text-ink/70 truncate">{p.user.email}</p>
        {p.listingTitle && <p className="text-sm mt-1">Room: <b>{p.listingTitle}</b></p>}
        <p className="text-sm mt-1"><b>{p.amount} THB</b> · sent {when(p.createdAt)}</p>
        {p.status === 'rejected' && <p className="text-sm text-red-700 mt-1">Rejected: {p.rejectReason}</p>}
        {p.status === 'approved' && <p className="text-sm text-nest-dark mt-1">Approved {when(p.reviewedAt)}</p>}

        {p.status === 'pending' && (
          rejecting ? (
            <div className="mt-3">
              <input className={inputClass} placeholder="Reason, for example: amount is wrong" value={reason} onChange={(e) => setReason(e.target.value)} aria-label="Reason" />
              <div className="flex gap-2 mt-2">
                <Button variant="ghost" onClick={() => setRejecting(false)}>Cancel</Button>
                <button disabled={busy || !reason.trim()} onClick={() => act('reject', { reason })} className="px-4 py-2 rounded-xl font-semibold bg-red-600 text-white disabled:opacity-50">Reject slip</button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2 mt-3">
              <Button disabled={busy} onClick={() => act('approve')}>Approve</Button>
              <Button variant="ghost" disabled={busy} onClick={() => setRejecting(true)}>Reject</Button>
            </div>
          )
        )}
        <div className="mt-2"><ErrorText>{error}</ErrorText></div>
      </div>
    </Card>
  )
}
