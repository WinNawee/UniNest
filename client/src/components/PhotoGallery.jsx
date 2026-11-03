import { useState } from 'react'
import { ChevronLeft, ChevronRight, ImageOff } from 'lucide-react'
import { photoUrl } from '../api'

// Room photos on a Housing card: one big photo with arrows to see the others.
export default function PhotoGallery({ photoIds = [], title }) {
  const [i, setI] = useState(0)
  const count = photoIds.length

  if (count === 0) {
    return (
      <div className="h-24 -mx-1 mb-3 rounded-xl bg-nest-soft/60 grid place-items-center text-ink/40 text-sm">
        <span className="flex items-center gap-2"><ImageOff size={18} /> No photos yet</span>
      </div>
    )
  }

  const go = (step) => setI((i + step + count) % count)
  const arrow = 'absolute top-1/2 -translate-y-1/2 w-9 h-9 grid place-items-center rounded-full bg-white/90 shadow hover:bg-white'

  return (
    <div className="relative aspect-[16/10] -mx-1 mb-3 rounded-xl overflow-hidden bg-nest-soft">
      <img src={photoUrl(photoIds[i])} alt={`${title}, photo ${i + 1} of ${count}`} className="w-full h-full object-cover" loading="lazy" />
      {count > 1 && (
        <>
          <button type="button" onClick={() => go(-1)} className={`${arrow} left-2`} aria-label="Previous photo"><ChevronLeft size={18} /></button>
          <button type="button" onClick={() => go(1)} className={`${arrow} right-2`} aria-label="Next photo"><ChevronRight size={18} /></button>
          <span className="absolute bottom-2 right-2 text-xs font-semibold text-white bg-black/55 rounded-full px-2 py-0.5">{i + 1} / {count}</span>
        </>
      )}
    </div>
  )
}
