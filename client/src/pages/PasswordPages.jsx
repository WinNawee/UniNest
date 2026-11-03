import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CircleX, MailCheck } from 'lucide-react'
import { api, setToken } from '../api'
import { Button, Card, ErrorText, Field, Logo, inputClass } from '../components/ui'

function Page({ children }) {
  return (
    <div className="min-h-screen grid place-items-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6"><Logo className="text-3xl" /></div>
        {children}
      </div>
    </div>
  )
}

// /forgot-password: ask for the email, then send a reset link.
export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      setSent(await api('/auth/forgot-password', { method: 'POST', body: { email } }))
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Page>
      <Card>
        {sent ? (
          <div className="text-center">
            <MailCheck className="mx-auto text-nest mb-2" size={36} />
            <p className="font-bold text-lg">Check your email</p>
            <p className="text-ink/70 mb-4">{sent.message} The link works for 1 hour. Also check your spam folder.</p>
            {sent.devResetUrl && (
              <a href={sent.devResetUrl} className="block mb-4 rounded-xl bg-sun/20 border border-sun p-3 text-sm font-semibold">
                Email is not set up on this computer. Open the reset link
              </a>
            )}
          </div>
        ) : (
          <form onSubmit={submit}>
            <h2 className="text-xl font-bold mb-1">Forgot your password?</h2>
            <p className="text-sm text-ink/70 mb-4">Enter the email you signed up with and we will send you a link to choose a new password.</p>
            <Field label="Email">
              <input type="email" className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
            </Field>
            <ErrorText>{error}</ErrorText>
            <Button disabled={busy} className="w-full">{busy ? 'Sending...' : 'Send reset link'}</Button>
          </form>
        )}
        <p className="text-center mt-4"><Link to="/" className="text-sm underline">Back to log in</Link></p>
      </Card>
    </Page>
  )
}

// /reset-password?token=...: the page the email link opens.
export function ResetPasswordPage({ onDone }) {
  const [params] = useSearchParams()
  const [password, setPassword] = useState('')
  const [again, setAgain] = useState('')
  const [error, setError] = useState('')
  const [broken, setBroken] = useState('') // the link itself is invalid or expired
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setError('')
    if (password !== again) return setError('The two passwords are not the same.')
    setBusy(true)
    try {
      const data = await api('/auth/reset-password', { method: 'POST', body: { token: params.get('token') || '', password } })
      setToken(data.token)
      await onDone() // logged in: the app opens the right first page
    } catch (err) {
      if (err.status === 400 && /link/.test(err.message)) setBroken(err.message)
      else setError(err.message)
      setBusy(false)
    }
  }

  if (broken) {
    return (
      <Page>
        <Card className="text-center">
          <CircleX className="mx-auto text-red-600 mb-2" size={36} />
          <p className="font-bold text-lg">This link did not work</p>
          <p className="text-ink/70 mb-4">{broken}</p>
          <Link to="/forgot-password" className="underline font-semibold">Send a new link</Link>
        </Card>
      </Page>
    )
  }

  return (
    <Page>
      <Card>
        <form onSubmit={submit}>
          <h2 className="text-xl font-bold mb-4">Choose a new password</h2>
          <Field label="New password" hint="At least 8 characters">
            <input type="password" className={inputClass} value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required autoFocus />
          </Field>
          <Field label="New password again">
            <input type="password" className={inputClass} value={again} onChange={(e) => setAgain(e.target.value)} required />
          </Field>
          <ErrorText>{error}</ErrorText>
          <Button disabled={busy} className="w-full">{busy ? 'Saving...' : 'Save and log in'}</Button>
        </form>
      </Card>
    </Page>
  )
}
