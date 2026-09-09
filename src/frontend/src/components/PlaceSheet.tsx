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
  'minority': 'Two shrines. The one with FEWER pilgrims is blessed — its side splits the room\'s stakes plus a pot from the treasury, by weight. The crowded shrine gets nothing. A dead heat refunds everyone.',
  'split-steal': 'You meet one other holder. HELP: both keep the stake plus a bonus. STEAL: take both stakes — unless they steal too, then both burn.',
  'commons': 'GIVE feeds the temple treasury and pays you its growth out of it. TAKE draws a share. Too many takers and the temple is plundered.',
  'hawk-dove': 'You meet one other holder. DOVE vs DOVE share the prize plus a bonus. HAWK takes most of it from a dove. HAWK vs HAWK fight: the heavier one usually wins a sliver, the rest burns.',
  'heist': 'Everyone here is one crew. LOYAL splits the stakes and a pot from the treasury by weight. BETRAY takes a double share — but if betrayers outnumber the loyal, the guards wake up and nobody gets a thing.',
  'all-pay': 'An auction where every bid is spent. The highest bid takes the prize (capped), ties go to weight. Everything else burns.',
  'volunteer': 'The reef needs one diver. DIVE costs you a little and the heaviest diver is the hero. WAIT earns more than a diver — unless nobody dives and every stake burns.',
  'stag-hunt': 'HARE is a safe small win. STAG pays a weight share of the pot only if three or more hunt — fewer and the stag hunters go home empty.',
  'ultimatum': 'You meet one other holder; the heavier one proposes. FAIR offers half. GREEDY offers crumbs. STRICT offers half and rejects greed — then the whole pot burns.',
  'soon': 'Opens soon.',
}

// What a place can actually pay this window is bounded by its treasury, so a
// drained place pays less than its headline pot. Show both — a prize that
// shrinks with no explanation is worse than a small one. (The pot is also
// capped at POT_TURNOUT_MULT x what the room stakes; that part depends on who
// turns up, which is exactly what we must not reveal mid-window.)
function potNow(place: PlaceView): { now: string, capped: boolean } | null {
  // all-pay pays its winner out of the losing bids, not out of the treasury.
  if (place.pot === '0' || place.engine === 'all-pay') return null
  const pot = BigInt(place.pot)
  const pool = BigInt(place.pool)
  const now = pool < pot ? pool : pot
  return { now: now.toString(), capped: now < pot }
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
  const moves = place.moves
  const moveLabel = (m: string) => (m.startsWith('bid') && place.bids ? `BID ${place.bids[Number(m.slice(3)) - 1]}` : m.toUpperCase())
  const pot = potNow(place)

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
            {place.engine === 'all-pay' ? `PRIZE CAP ${place.pot}` : `STAKE ${place.stake}`}
            {pot ? ` · POT ${pot.now}${pot.capped ? ` OF ${place.pot}` : ''}` : ''}
            {` · TREASURY ${place.pool}`}
            {` · LAST WINDOW ${place.lastCrowd} HERE`}
          </div>
          {pot?.capped && (
            <div className="px-body" style={{ fontSize: 14, color: 'var(--cw-text-dim)' }}>
              This place has paid out more than it took in — the pot is capped at its treasury until visitors refill it.
            </div>
          )}
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
                <button key={m} type="button" className={move === m ? 'px-btn' : 'px-btn-ghost'} disabled={busy} onClick={() => { setMove(m); onVisit(m) }}>{moveLabel(m)}</button>
              ))}
        </div>
      )}
      {!place.open && <div className="px-label" style={{ fontSize: 7, color: 'var(--cw-text-faint)' }}>OPENS SOON</div>}
      {error && <div className="px-body" style={{ fontSize: 16, color: 'var(--cw-red-bright)' }}>{error}</div>}
      {inviteCode && !here && <div className="px-label" style={{ fontSize: 7 }}>MEET LINK ATTACHED</div>}
    </div>
  )
}
