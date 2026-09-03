import type { ClaimStatus } from '../api'
import { useCallback, useEffect, useState } from 'react'
import { claimDaily, claimStatus } from '../api'
import { haptic } from '../telegram'

interface DailyClaimProps {
  onBalance: (votes: string) => void
}

// Streak dots + CLAIM / CLAIMED countdown. Used by the hub card and EARN.
export function DailyClaim({ onBalance }: DailyClaimProps) {
  const [claim, setClaim] = useState<ClaimStatus | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const status = await claimStatus()
      if (!status.error) setClaim(status)
    } catch {
      // keep the previous snapshot
    }
  }, [])

  useEffect(() => {
    void refresh()
    const timer = setInterval(() => void refresh(), 30_000)
    return () => clearInterval(timer)
  }, [refresh])

  async function onClaim() {
    if (busy) return
    setBusy(true)
    setNotice(null)
    try {
      const result = await claimDaily()
      if (result.error) {
        setNotice(result.error)
      } else {
        onBalance(result.balance)
        haptic('success')
      }
      await refresh()
    } catch {
      setNotice('Network error — try again')
    } finally {
      setBusy(false)
    }
  }

  if (!claim) {
    return <div className="px-pulse px-label" style={{ textAlign: 'center' }}>…</div>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', gap: 3 }}>
        {Array.from({ length: 7 }, (_, i) => (
          <div key={i} style={{ flex: 1, height: 10, background: i < Math.min(claim.streakDays, 7) ? 'var(--cw-gold)' : 'var(--cw-border)' }} />
        ))}
      </div>
      <div style={{ fontSize: 17, color: 'var(--cw-text)' }}>
        {`Day ${claim.streakDays} streak · ×${claim.claimMultiplier}`}
      </div>
      {claim.canClaim
        ? (
            <button type="button" className="px-btn" style={{ padding: '10px 0', fontSize: 8 }} disabled={busy} onClick={() => void onClaim()}>
              {`CLAIM +${claim.rawClaimAmount}`}
            </button>
          )
        : (
            <div className="px-label" style={{ color: 'var(--cw-green)', background: 'var(--cw-bg-deep)', border: '2px solid var(--cw-border-dark)', padding: 10, textAlign: 'center', fontSize: 7 }}>
              {`CLAIMED · ${formatSeconds(claim.secondsUntilClaim)}`}
            </div>
          )}
      {notice && <div style={{ fontSize: 16, color: 'var(--cw-red-bright)' }}>{notice}</div>}
    </div>
  )
}

export function formatSeconds(total: number): string {
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}
