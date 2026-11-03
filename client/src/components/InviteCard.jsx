import { useEffect, useState } from 'react'
import { Check, Copy, Gift } from 'lucide-react'
import { api } from '../api'
import { Card } from './ui'

// "Invite a friend": shows the student's link and how many days they have earned.
export default function InviteCard() {
  const [data, setData] = useState(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => { api('/referral').then(setData).catch(() => {}) }, [])
  if (!data) return null

  async function copy() {
    try {
      await navigator.clipboard.writeText(data.link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* clipboard blocked: the link is still visible to copy by hand */ }
  }

  return (
    <Card className="min-w-0">
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-full bg-sun/30 grid place-items-center shrink-0"><Gift size={22} /></div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold">Invite a friend, you both get {data.rewardDays} days of Premium</h3>
          <p className="text-sm text-ink/70">When a friend signs up with your link and confirms their email, you each get {data.rewardDays} free days. Up to {data.maxFriends} friends.</p>
          <div className="flex gap-2 mt-3">
            <input readOnly value={data.link} className="flex-1 min-w-0 w-full border border-black/10 rounded-xl px-3 py-2 bg-cream text-sm" aria-label="Your invite link" onFocus={(e) => e.target.select()} />
            <button onClick={copy} className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-nest text-white font-semibold text-sm">
              {copied ? <><Check size={16} /> Copied</> : <><Copy size={16} /> Copy</>}
            </button>
          </div>
          <p className="text-sm mt-2">
            Your code <b className="tracking-wider">{data.code}</b> · <b>{data.friendsJoined}</b> friends joined
            {data.friendsWaiting > 0 && <> · {data.friendsWaiting} waiting to confirm</>} · <b>{data.daysEarned}</b> days earned
          </p>
        </div>
      </div>
    </Card>
  )
}
