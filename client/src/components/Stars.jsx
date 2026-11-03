import { Star } from 'lucide-react'

// Shows a rating as stars. With onPick it becomes a 1 to 5 star picker.
export default function Stars({ value = 0, size = 16, onPick }) {
  return (
    <span className="inline-flex items-center gap-0.5" role={onPick ? 'radiogroup' : 'img'} aria-label={onPick ? 'Rating' : `${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = n <= Math.round(value)
        const star = <Star size={size} className={filled ? 'fill-amber-400 text-amber-400' : 'text-black/20'} />
        return onPick ? (
          <button key={n} type="button" onClick={() => onPick(n)} role="radio" aria-checked={n === value} aria-label={`${n} star${n > 1 ? 's' : ''}`} className="p-0.5">
            {star}
          </button>
        ) : <span key={n}>{star}</span>
      })}
    </span>
  )
}
