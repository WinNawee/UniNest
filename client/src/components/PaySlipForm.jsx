import { useState } from 'react'
import { ImageUp, TriangleAlert, XCircle } from 'lucide-react'
import { api } from '../api'
import { compressImage } from '../image'
import { Button, ErrorText } from './ui'

// PromptPay QR + slip upload, used for Premium (students) and Featured Listings (landlords).
// postTo: API path that receives { slip }.
export default function PaySlipForm({ amount, qr, testMode, payTo, postTo, lastRejected, onUploaded }) {
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
      await api(postTo, { method: 'POST', body: { slip } })
      onUploaded()
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <div>
      {lastRejected && (
        <div className="flex gap-2 bg-red-50 text-red-800 rounded-xl p-3 mb-4 text-sm">
          <XCircle size={18} className="shrink-0" />
          <p>Your last slip was not accepted: <b>{lastRejected.rejectReason}</b>. Please upload a new one.</p>
        </div>
      )}

      <h3 className="font-bold mb-1">1. Scan and pay with PromptPay</h3>
      <p className="text-sm text-ink/70 mb-3">Open any Thai banking app, scan the QR and check the amount is {amount} THB.</p>
      {testMode && (
        <div className="flex gap-2 bg-sun/25 border border-sun rounded-xl p-2.5 mb-3 text-sm">
          <TriangleAlert size={18} className="shrink-0" />
          <p><b>Test QR. Do not pay.</b> No PromptPay number is set on this server yet.</p>
        </div>
      )}
      <div className="flex flex-col items-center bg-white border border-black/10 rounded-2xl p-4 mb-1">
        <p className="text-xs font-bold tracking-wider text-[#113566] mb-2">THAI QR PAYMENT · PROMPTPAY</p>
        <img src={qr} alt={`PromptPay QR for ${amount} THB`} className={`w-52 h-52 ${testMode ? 'opacity-40' : ''}`} />
        <p className="font-bold text-lg mt-2">{amount}.00 THB</p>
        {payTo && <p className="text-sm text-ink/70">Pay to {payTo}</p>}
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
    </div>
  )
}
