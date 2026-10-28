import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { CircleCheck, CircleX } from 'lucide-react'
import { api, setToken } from '../api'
import { Card, Logo } from '../components/ui'
import CheckEmail from '../components/CheckEmail'

// The page the email link opens: /verify-email?token=...
export default function VerifyEmailPage({ onDone }) {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [state, setState] = useState({ status: 'working' })
  const started = useRef(false) // the link works once, so only call the API once

  useEffect(() => {
    if (started.current) return
    started.current = true
    const token = params.get('token') || ''
    api('/auth/verify-email', { method: 'POST', body: { token } })
      .then(async (data) => {
        setToken(data.token)
        setState({ status: 'done' })
        await onDone() // loads the account; the app then opens the right first page
      })
      .catch((err) => setState({ status: 'error', message: err.message, expired: err.data?.expired, email: err.data?.email }))
  }, [params, onDone])

  return (
    <div className="min-h-screen grid place-items-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6"><Logo className="text-3xl" /></div>
        {state.status === 'working' && <Card className="text-center">Confirming your email...</Card>}
        {state.status === 'done' && (
          <Card className="text-center">
            <CircleCheck className="mx-auto text-nest mb-2" size={36} />
            <p className="font-bold text-lg">Email confirmed</p>
            <p className="text-ink/70">Welcome to UniNest. Taking you in...</p>
          </Card>
        )}
        {state.status === 'error' && state.expired && (
          <CheckEmail email={state.email} fromLogin onBack={() => navigate('/', { replace: true })} />
        )}
        {state.status === 'error' && !state.expired && (
          <Card className="text-center">
            <CircleX className="mx-auto text-red-600 mb-2" size={36} />
            <p className="font-bold text-lg">This link did not work</p>
            <p className="text-ink/70 mb-4">{state.message}</p>
            <button onClick={() => navigate('/', { replace: true })} className="underline">Go to log in</button>
          </Card>
        )}
      </div>
    </div>
  )
}
