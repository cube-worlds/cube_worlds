import type { PlaceView, VisitView } from '../api'
import { useState } from 'react'
import { openShare } from '../telegram'
import { DailyClaim } from './DailyClaim'

interface PlaceSheetProps {
  place: PlaceView
  myVisit: VisitView | null
  endsAt: number
  botName: string
  inviteHost: { name: string, index: number } | null
  inviteCode: string | null
  busy: boolean
  error: string | null
  onVisit: (move?: string) => void
  onClose: () => void
  onBalance: (votes: string) => void
}

const RULES: Record<PlaceView['engine'], string> = {
  'rest': 'Stay in. Claim your daily $CUBE. No risk, no crowd.',
  'minority': 'A fixed pot split by your weight among everyone who comes. Fewer visitors, bigger share.',
  'split-steal': 'You meet one other holder. HELP: both keep the stake plus a bonus. STEAL: take both stakes — unless they steal too, then both burn.',
  'commons': 'GIVE feeds the temple pool and pays you its growth. TAKE draws a share. Too many takers and the temple is plundered.',
  'soon': 'Opens soon.',
}

function countdown(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return `${h}h ${String(m).padStart(2, '0')}m`
}

export function PlaceSheet({ place, myVisit, endsAt, botName, inviteHost, inviteCode, busy, error, onVisit, onClose, onBalance }: PlaceSheetProps) {
  const [move, setMove] = useState<string | null>(null)
  const here = myVisit?.place === place.id
  const elsewhere = myVisit && !here
  const moves = place.engine === 'split-steal' ? ['help', 'steal'] : place.engine === 'commons' ? ['give', 'take'] : []
  const label = place.engine === 'minority' ? 'FEE' : 'STAKE'

  return (
    <div className="px-card" style={{ position: 'fixed', left: 0, right: 0, bottom: 62, padding: 14, display: 'flex', flexDirection: 'column', gap: 10, borderTop: '3px solid var(--cw-gold-deep)', maxHeight: '70vh', overflowY: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="px-title" style={{ fontSize: 11 }}>{place.name.toUpperCase()}</div>
        <button type="button" className="px-back" onClick={onClose}>✕</button>
      </div>
      <div className="px-body" style={{ fontSize: 16 }}>{RULES[place.engine]}</div>

      {place.engine === 'rest' && <DailyClaim onBalance={onBalance} />}

      {place.engine !== 'rest' && place.open && (
        <>
          <div className="px-label" style={{ fontSize: 7, color: 'var(--cw-text-dim)' }}>
            {`${label} ${place.stake}`}
            {place.engine === 'minority' ? ` · POT ${place.pot}` : ''}
            {place.pool ? ` · POOL ${place.pool}` : ''}
            {` · LAST WINDOW ${place.lastCrowd} HERE`}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {place.traits.map(t => (
              <span key={t.name} className="px-label" style={{ fontSize: 7, border: '1px solid var(--cw-border)', padding: '4px 6px' }}>{`${t.name.toUpperCase()} ${t.value}`}</span>
            ))}
            <span className="px-label" style={{ fontSize: 7, color: 'var(--cw-gold)' }}>{`WEIGHT ${place.weight}`}</span>
          </div>
        </>
      )}

      {inviteHost && place.engine === 'split-steal' && !here && (
        <div className="px-body" style={{ fontSize: 16, color: 'var(--cw-gold)' }}>{`${inviteHost.name} (pass #${inviteHost.index}) is waiting for you here.`}</div>
      )}

      {here && myVisit && (
        <div className="px-body" style={{ fontSize: 16 }}>
          {`You are at ${place.name}${myVisit.move ? ` · ${myVisit.move.toUpperCase()}` : ''} · resolves in ${countdown(endsAt - Date.now())}`}
          {myVisit.partnerId ? ' · with your friend' : ''}
        </div>
      )}
      {here && myVisit?.inviteCode && !myVisit.partnerId && (
        <button type="button" className="px-btn-ghost" onClick={() => openShare(`https://t.me/${botName}?startapp=meet_${myVisit.inviteCode}`, `Meet me at Canggu — help or steal?`)}>SHARE MEET LINK</button>
      )}
      {elsewhere && <div className="px-body" style={{ fontSize: 16, color: 'var(--cw-text-dim)' }}>{`You already went to ${myVisit.place} this window.`}</div>}

      {!myVisit && place.open && place.engine !== 'rest' && (
        <div style={{ display: 'flex', gap: 8 }}>
          {moves.length === 0
            ? <button type="button" className="px-btn" disabled={busy} onClick={() => onVisit()}>GO</button>
            : moves.map(m => (
                <button key={m} type="button" className={move === m ? 'px-btn' : 'px-btn-ghost'} disabled={busy} onClick={() => { setMove(m); onVisit(m) }}>{m.toUpperCase()}</button>
              ))}
        </div>
      )}
      {!place.open && <div className="px-label" style={{ fontSize: 7, color: 'var(--cw-text-faint)' }}>OPENS SOON</div>}
      {error && <div className="px-body" style={{ fontSize: 16, color: 'var(--cw-red-bright)' }}>{error}</div>}
      {inviteCode && !here && <div className="px-label" style={{ fontSize: 7 }}>MEET LINK ATTACHED</div>}
    </div>
  )
}
