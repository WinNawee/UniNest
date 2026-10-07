import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import { Button, Card, ErrorText, Field, inputClass } from '../components/ui'

const SLIDERS = [
  ['cleanliness', 'How tidy do you keep your space?', 'Relaxed', 'Very tidy'],
  ['sleep', 'When do you usually sleep?', 'Early bird', 'Night owl'],
  ['noise', 'How much noise can you live with?', 'Need silence', 'Fine with noise'],
  ['social', 'How social are you at home?', 'Homebody', 'Very social'],
  ['study', 'How do you like to study?', 'Quiet and alone', 'In a group'],
  ['guests', 'How often do you have guests over?', 'Never', 'Often'],
  ['culturalOpenness', 'How much do you enjoy other cultures?', 'Prefer familiar', 'Love new cultures'],
]

const DEFAULTS = {
  cleanliness: 3, sleep: 3, noise: 3, social: 3, study: 3, guests: 3, culturalOpenness: 3,
  budgetMin: 4000, budgetMax: 7000, smoking: 'no', food: 'any', gender: 'female',
  genderPref: 'any', languages: 'English', campus: 'AIT',
}

export default function QuestionnairePage({ profile, onSaved }) {
  const [form, setForm] = useState(() =>
    profile ? { ...profile, languages: profile.languages.join(', ') } : DEFAULTS
  )
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const navigate = useNavigate()
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  async function submit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await api('/me/profile', {
        method: 'PUT',
        body: {
          ...form,
          languages: String(form.languages).split(',').map((s) => s.trim()).filter(Boolean),
          budgetMin: Number(form.budgetMin),
          budgetMax: Number(form.budgetMax),
        },
      })
      await onSaved()
      navigate('/matches')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold mb-1">Tell us about your lifestyle</h2>
      <p className="mb-5">Your answers are used to find roommates who fit you. Other students only see your match score, not your answers.</p>

      <Card className="mb-4">
        {SLIDERS.map(([key, label, left, right]) => (
          <Field key={key} label={label}>
            <input
              type="range" min="1" max="5" step="1" value={form[key]}
              onChange={set(key)} className="w-full accent-nest"
            />
            <span className="flex justify-between text-xs text-ink/60"><span>{left}</span><span>{right}</span></span>
          </Field>
        ))}
      </Card>

      <Card className="mb-4">
        <div className="grid sm:grid-cols-2 gap-x-4">
          <Field label="Monthly budget from (THB)">
            <input type="number" min="0" className={inputClass} value={form.budgetMin} onChange={set('budgetMin')} />
          </Field>
          <Field label="Monthly budget up to (THB)">
            <input type="number" min="0" className={inputClass} value={form.budgetMax} onChange={set('budgetMax')} />
          </Field>
          <Field label="Smoking">
            <select className={inputClass} value={form.smoking} onChange={set('smoking')}>
              <option value="no">Not at all</option>
              <option value="outside">Only outside</option>
              <option value="yes">Fine indoors</option>
            </select>
          </Field>
          <Field label="Food">
            <select className={inputClass} value={form.food} onChange={set('food')}>
              <option value="any">Eat anything</option>
              <option value="any_with_pork">Eat anything, including pork</option>
              <option value="halal">Halal</option>
              <option value="vegetarian">Vegetarian</option>
            </select>
          </Field>
          <Field label="Languages you speak" hint="Separate with commas">
            <input className={inputClass} value={form.languages} onChange={set('languages')} />
          </Field>
          <Field label="University">
            <input className={inputClass} value={form.campus} onChange={set('campus')} placeholder="AIT" />
          </Field>
          <Field label="Gender">
            <select className={inputClass} value={form.gender} onChange={set('gender')}>
              <option value="female">Female</option>
              <option value="male">Male</option>
              <option value="other">Other</option>
            </select>
          </Field>
          <Field label="Roommate preference">
            <select className={inputClass} value={form.genderPref} onChange={set('genderPref')}>
              <option value="any">Any gender</option>
              <option value="same">Same gender only</option>
            </select>
          </Field>
        </div>
      </Card>

      <ErrorText>{error}</ErrorText>
      <Button disabled={busy}>Save and see my matches</Button>
    </form>
  )
}
