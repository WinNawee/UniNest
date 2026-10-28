import { useState } from 'react'
import { MailCheck } from 'lucide-react'
import { api } from '../api'
import { Button, Card, ErrorText } from './ui'

// Shown after sign-up, or when someone tries to log in before confirming.
export default function CheckEmail({ email, emailSent, devVerifyUrl, fromLogin, onBack }) {
  const [devLink, setDevLink] = useState(devVerifyUrl)
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function resend() {
    setBusy(true)
    setNote('')
    setError('')
    try {
      const data = await api('/auth/resend-verification', { method: 'POST', body: { email } })
      setNote(data.emailSent === false ? 'A new link was made.' : 'A new link is on its way. Check your inbox and spam folder.')
      if (data.devVerifyUrl) setDevLink(data.devVerifyUrl)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="text-center">
      <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-nest-soft text-nest grid place-items-center">
        <MailCheck size={28} />
      </div>
      <h2 className="text-xl font-bold mb-1">{fromLogin ? 'Please confirm your email' : 'Check your email'}</h2>
      <p className="text-ink/70 mb-4">
        {fromLogin
          ? <>Your account <b>{email}</b> is not confirmed yet. Open the link we sent you, or ask for a new one.</>
          : emailSent === false
            ? <>Your account for <b>{email}</b> is created. Confirm your email to finish.</>
            : <>We sent a confirmation link to <b>{email}</b>. Open it to finish creating your account.</>}
      </p>

      {devLink && (
        <div className="text-left bg-sun/20 border border-sun rounded-xl p-3 mb-4 text-sm">
          <p className="font-semibold mb-1">Email is not set up on this server</p>
          <p className="mb-2 text-ink/70">For testing, you can confirm with this link. It is also printed in the server terminal.</p>
          <a href={devLink} className="inline-block px-3 py-1.5 rounded-lg bg-nest text-white font-semibold">Confirm my email</a>
        </div>
      )}
      {emailSent === false && !devLink && (
        <p className="text-sm text-red-700 mb-4">We could not send the email right now. Please try "Send a new link".</p>
      )}

      {note && <p className="text-sm text-nest-dark mb-3">{note}</p>}
      <ErrorText>{error}</ErrorText>
      <div className="flex flex-col gap-2">
        <Button variant="ghost" onClick={resend} disabled={busy}>Send a new link</Button>
        <button onClick={onBack} className="text-sm underline text-ink/70">Back to log in</button>
      </div>
    </Card>
  )
}
