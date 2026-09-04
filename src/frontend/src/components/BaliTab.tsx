import type { WorldState } from '../api'
import { useCallback, useEffect, useState } from 'react'
import { worldPass, worldState, worldVisit } from '../api'
import { haptic } from '../telegram'
import { BaliMap } from './BaliMap'
import { PlaceSheet } from './PlaceSheet'

interface BaliTabProps {
  botName: string
  startPlace: string | null
  inviteCode: string | null
  onBalance: (votes: string) => void
}

function countdown(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(s / 3600)}h ${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}m`
}

export function BaliTab({ botName, startPlace, inviteCode, onBalance }: BaliTabProps) {
  const [state, setState] = useState<WorldState | null>(null)
  const [selected, setSelected] = useState<string | null>(startPlace ?? (inviteCode ? 'canggu' : null))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [invite, setInvite] = useState<{ code: string, host: { name: string, index: number } | null } | null>(inviteCode ? { code: inviteCode, host: null } : null)
  const [, setTick] = useState(0)

  const refresh = useCallback(async () => {
    try {
      const next = await worldState()
      if (!next.error) {
        setState(next)
        onBalance(next.balance)
      }
    } catch {
      // keep previous snapshot
    }
  }, [onBalance])

  useEffect(() => {
    void refresh()
    const timer = setInterval(() => { void refresh(); setTick(t => t + 1) }, 30_000)
    return () => clearInterval(timer)
  }, [refresh])

  // Meet landing: invite codes are `<hostPassIndex>-<random>`, so the host's
  // public pass (name, index) comes from GET /api/world/pass/:index.
  useEffect(() => {
    if (!inviteCode) return
    const match = /^(\d+)-/.exec(inviteCode)
    if (!match) return
    void worldPass(Number(match[1])).then(p => setInvite(i => (i ? { ...i, host: { name: p.name, index: p.index } } : i))).catch(() => {})
  }, [inviteCode])

  const visit = async (move?: string) => {
    if (!selected || !state) return
    setBusy(true)
    setError(null)
    try {
      const res = await worldVisit(selected, move, selected === 'canggu' && invite ? invite.code : undefined)
      if (res.error) {
        setError(res.error)
        haptic('error')
      } else {
        haptic('success')
        await refresh()
      }
    } catch {
      setError('Cannot reach Bali, try again')
    } finally {
      setBusy(false)
    }
  }

  if (!state) {
    return <div className="px-body" style={{ padding: 16 }}>Sailing to Bali…</div>
  }
  const place = selected ? state.places.find(p => p.id === selected) ?? null : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '14px 12px 200px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <div className="px-step">BALI · WINDOW {state.windowId % 3 === 0 ? 'NIGHT' : state.windowId % 3 === 1 ? 'MORNING' : 'AFTERNOON'}</div>
        <div className="px-label" style={{ fontSize: 7, color: 'var(--cw-gold)' }}>{`CLOSES IN ${countdown(state.endsAt - Date.now())}`}</div>
      </div>
      <BaliMap places={state.places} myPlace={state.myVisit?.place ?? null} selected={selected} onSelect={(id) => { setSelected(id); setError(null) }} />
      {state.myVisit
        ? <div className="px-body" style={{ fontSize: 16 }}>{`You are at ${state.places.find(p => p.id === state.myVisit?.place)?.name ?? state.myVisit.place}. Come back after the window closes.`}</div>
        : <div className="px-body" style={{ fontSize: 16, color: 'var(--cw-text-dim)' }}>Tap a place. One visit per window.</div>}
      {place && (
        <PlaceSheet
          place={place}
          myVisit={state.myVisit}
          endsAt={state.endsAt}
          botName={botName}
          inviteHost={invite?.host ?? null}
          inviteCode={invite?.code ?? null}
          busy={busy}
          error={error}
          onVisit={visit}
          onClose={() => setSelected(null)}
          onBalance={onBalance}
        />
      )}
    </div>
  )
}
