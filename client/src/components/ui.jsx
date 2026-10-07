export function Card({ children, className = '' }) {
  return <div className={`bg-white rounded-2xl shadow-sm border border-black/5 p-5 ${className}`}>{children}</div>
}

export function Button({ children, className = '', variant = 'primary', ...props }) {
  const styles = {
    primary: 'bg-nest text-white hover:bg-nest-dark shadow-sm shadow-nest/20',
    sun: 'bg-sun text-ink hover:brightness-95',
    ghost: 'bg-white border border-black/10 hover:bg-nest-soft',
  }
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl font-semibold transition disabled:opacity-50 ${styles[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}

export function Field({ label, children, hint }) {
  return (
    <label className="block mb-4">
      <span className="block text-sm font-semibold mb-1">{label}</span>
      {children}
      {hint && <span className="block text-xs text-ink/60 mt-1">{hint}</span>}
    </label>
  )
}

export const inputClass =
  'w-full border border-black/10 rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-nest/60 focus:border-nest'

export function ErrorText({ children }) {
  return children ? <p className="text-red-700 text-sm mb-3" role="alert">{children}</p> : null
}

export function ScoreBar({ value }) {
  return (
    <div className="h-2 rounded-full bg-nest-soft overflow-hidden">
      <div className="h-full rounded-full bg-gradient-to-r from-nest to-emerald-400" style={{ width: `${value}%` }} />
    </div>
  )
}

// Same name always gets the same soft colour.
const AVATAR_COLORS = ['bg-sun text-ink', 'bg-nest text-white', 'bg-emerald-200 text-nest-dark', 'bg-amber-100 text-amber-900', 'bg-teal-100 text-teal-900']
export function Avatar({ name = '?', size = 'md' }) {
  const sizes = { sm: 'w-9 h-9 text-sm', md: 'w-11 h-11 text-base', lg: 'w-14 h-14 text-xl' }
  const color = AVATAR_COLORS[[...name].reduce((s, c) => s + c.charCodeAt(0), 0) % AVATAR_COLORS.length]
  return (
    <div className={`${sizes[size]} ${color} shrink-0 rounded-full grid place-items-center font-bold ring-2 ring-white`}>
      {name.trim()[0]?.toUpperCase()}
    </div>
  )
}

export function PageTitle({ title, subtitle }) {
  return (
    <div className="mb-5">
      <h2 className="text-2xl font-bold">{title}</h2>
      {subtitle && <p className="text-ink/70">{subtitle}</p>}
    </div>
  )
}

// light = white badge for use on the green background.
export function Logo({ className = '', light = false }) {
  return (
    <span className={`inline-flex items-center gap-2 font-bold ${light ? 'text-white' : 'text-nest'} ${className}`}>
      <svg viewBox="0 0 32 32" className="w-8 h-8" aria-hidden="true">
        <rect width="32" height="32" rx="9" fill={light ? '#fff' : '#2f9068'} />
        <path d="M8 16.5 16 9l8 7.5V24a1 1 0 0 1-1 1h-4.5v-5h-5v5H9a1 1 0 0 1-1-1z" fill={light ? '#2f9068' : '#fff'} />
        <circle cx="16" cy="16" r="1.6" fill="#f5c94c" />
      </svg>
      UniNest
    </span>
  )
}
