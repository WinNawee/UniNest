import { useState } from 'react'
import { api, setToken } from '../api'
import { HeartHandshake, MessageCircle, ShieldCheck } from 'lucide-react'
import { Button, Card, ErrorText, Field, Logo, inputClass } from '../components/ui'

export default function AuthPage({ onDone }) {
  const [mode, setMode] = useState('login')
  const [role, setRole] = useState('student')
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  async function submit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const path = mode === 'login' ? '/auth/login' : '/auth/register'
      const body = mode === 'login' ? { email: form.email, password: form.password } : { ...form, role }
      const { token } = await api(path, { method: 'POST', body })
      setToken(token)
      await onDone()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <aside className="hidden lg:flex flex-col justify-between p-12 bg-gradient-to-br from-nest to-nest-dark text-white relative overflow-hidden">
        <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full bg-white/10" />
        <div className="absolute bottom-10 -left-16 w-56 h-56 rounded-full bg-sun/30" />
        <Logo light className="text-2xl relative" />
        <div className="relative">
          <h1 className="text-4xl font-bold leading-tight mb-4">Find the right roommate.<br />Find the right home.</h1>
          <ul className="space-y-3 text-white/90">
            <li className="flex items-center gap-3"><HeartHandshake size={20} /> Matched on lifestyle, budget and study habits</li>
            <li className="flex items-center gap-3"><ShieldCheck size={20} /> Verified students and checked listings</li>
            <li className="flex items-center gap-3"><MessageCircle size={20} /> Chat safely before sharing contacts</li>
          </ul>
        </div>
        <p className="text-sm text-white/60 relative">Made for international and first-year students.</p>
      </aside>
      <div className="grid place-items-center p-4">
      <div className="w-full max-w-md">
        <div className="lg:hidden text-center mb-6">
          <Logo className="text-3xl" />
          <p className="mt-1">Find the right roommate. Find the right home.</p>
        </div>
        <h2 className="hidden lg:block text-2xl font-bold mb-4">Welcome</h2>
        <Card>
          <div className="flex gap-2 mb-5">
            {['login', 'register'].map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); setError('') }}
                className={`flex-1 py-2 rounded-xl font-semibold ${mode === m ? 'bg-nest text-white' : 'bg-nest-soft'}`}
              >
                {m === 'login' ? 'Log in' : 'Sign up'}
              </button>
            ))}
          </div>
          <form onSubmit={submit}>
            {mode === 'register' && (
              <>
                <Field label="I am a">
                  <select className={inputClass} value={role} onChange={(e) => setRole(e.target.value)}>
                    <option value="student">Student</option>
                    <option value="landlord">Landlord or dorm manager</option>
                  </select>
                </Field>
                <Field label="Name">
                  <input className={inputClass} value={form.name} onChange={set('name')} required />
                </Field>
              </>
            )}
            <Field
              label="Email"
              hint={mode === 'register' && role === 'student' ? 'Use your university email (for example name@ait.ac.th)' : undefined}
            >
              <input type="email" className={inputClass} value={form.email} onChange={set('email')} required />
            </Field>
            <Field label="Password" hint={mode === 'register' ? 'At least 8 characters' : undefined}>
              <input type="password" className={inputClass} value={form.password} onChange={set('password')} required />
            </Field>
            <ErrorText>{error}</ErrorText>
            <Button disabled={busy} className="w-full">{mode === 'login' ? 'Log in' : 'Create account'}</Button>
          </form>
          <p className="text-xs text-ink/60 mt-4">
            Demo student: mali@ait.ac.th, demo landlord: owner@baansuan.example. Password for both: demo1234
          </p>
        </Card>
      </div>
      </div>
    </div>
  )
}
