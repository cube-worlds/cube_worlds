import type { PassPublic } from '../api'
import { useEffect, useState } from 'react'
import { worldChallenge, worldPass } from '../api'
import { haptic, openShare } from '../telegram'
import { PassImage } from './PassScan'

// Public face of a pass: Bali reputation and top traits (from /api/world/pass/:index).
export function PassPublicBlock({ pub }: { pub: PassPublic }) {
  return (
    <div style={{ background: 'var(--cw-bg-deep)', border: '2px solid var(--cw-border-dark)', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div className="px-label" style={{ fontSize: 7 }}>REPUTATION</div>
      <div className="px-body" style={{ fontSize: 16 }}>{`helped ${pub.rep.helped} · stole ${pub.rep.stole} · gave ${pub.rep.gave} · took ${pub.rep.took}`}</div>
      <div className="px-label" style={{ fontSize: 7 }}>TOP TRAITS</div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {pub.top.map(t => <span key={t.name} className="px-label" style={{ fontSize: 7, border: '1px solid var(--cw-border)', padding: '4px 6px' }}>{`${t.name.toUpperCase()} ${t.value}`}</span>)}
      </div>
    </div>
  )
}

export function usePublicPass(index: number | null): PassPublic | null {
  const [pub, setPub] = useState<PassPublic | null>(null)
  useEffect(() => {
    setPub(null)
    if (index === null) return
    void worldPass(index).then((p) => { if (!p.error) setPub(p) }).catch(() => {})
  }, [index])
  return pub
}

type ChallengeState =
  | { kind: 'idle' }
  | { kind: 'pick' }
  | { kind: 'busy' }
  | { kind: 'sent' }
  | { kind: 'undelivered', inviteCode: string }
  | { kind: 'error', text: string }

// CHALLENGE AT CANGGU: commits my Canggu visit (if I have none) and DMs this
// pass the meet link. Spends the Canggu stake; the server refuses if I am
// already somewhere else this window.
function ChallengeBlock({ index, name, botName, meetStake, onVisited }: { index: number, name: string, botName: string, meetStake: string | null, onVisited?: () => void }) {
  const [st, setSt] = useState<ChallengeState>({ kind: 'idle' })

  const send = async (move: 'help' | 'steal') => {
    setSt({ kind: 'busy' })
    try {
      const res = await worldChallenge(index, move)
      if (res.error || !res.visit) {
        haptic('error')
        setSt({ kind: 'error', text: res.error ?? 'Challenge failed' })
        return
      }
      haptic('success')
      onVisited?.()
      setSt(res.delivered ? { kind: 'sent' } : { kind: 'undelivered', inviteCode: res.visit.inviteCode ?? '' })
    } catch {
      setSt({ kind: 'error', text: 'Cannot reach Bali, try again' })
    }
  }

  const label = `CHALLENGE AT CANGGU${meetStake ? ` · ${meetStake} $CUBE` : ''}`
  switch (st.kind) {
    case 'idle':
      return <button type="button" className="px-btn" onClick={() => setSt({ kind: 'pick' })}>{label}</button>
    case 'pick':
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="px-body" style={{ fontSize: 16 }}>{`Meet ${name} at Canggu — your move is sealed until the window closes.`}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="px-btn" onClick={() => void send('help')}>HELP</button>
            <button type="button" className="px-btn-ghost" onClick={() => void send('steal')}>STEAL</button>
          </div>
          <button type="button" className="px-btn-ghost" onClick={() => setSt({ kind: 'idle' })}>CANCEL</button>
        </div>
      )
    case 'busy':
      return <div className="px-body" style={{ fontSize: 16 }}>Sending the challenge…</div>
    case 'sent':
      return <div className="px-body" style={{ fontSize: 16, color: 'var(--cw-green)' }}>{`Challenge sent. ${name} has until the window closes to accept.`}</div>
    case 'undelivered':
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="px-body" style={{ fontSize: 16, color: 'var(--cw-gold)' }}>{`You are at Canggu, but ${name} could not be messaged. Send them the link yourself.`}</div>
          <button type="button" className="px-btn-ghost" onClick={() => openShare(`https://t.me/${botName}?startapp=meet_${st.inviteCode}`, `Meet me at Canggu — help or steal?`)}>SHARE MEET LINK</button>
        </div>
      )
    case 'error':
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="px-body" style={{ fontSize: 16, color: 'var(--cw-red-bright)' }}>{st.text}</div>
          <button type="button" className="px-btn-ghost" onClick={() => setSt({ kind: 'idle' })}>BACK</button>
        </div>
      )
  }
}

// Modal peek at another holder's pass.
export function PassPeek({ index, botName, meetStake, onVisited, onClose }: { index: number, botName: string, meetStake: string | null, onVisited?: () => void, onClose: () => void }) {
  const pub = usePublicPass(index)
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 20 }} onClick={onClose}>
      <div className="px-card" style={{ width: '100%', maxWidth: 360, padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }} onClick={e => e.stopPropagation()}>
        {pub
          ? (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                  <PassImage src={pub.image} size={120} border="3px solid var(--cw-gold-dark)" />
                  <div className="px-title" style={{ fontSize: 10 }}>{pub.name}</div>
                  <div className="px-label" style={{ fontSize: 7 }}>{`PASS #${pub.index}`}</div>
                </div>
                <PassPublicBlock pub={pub} />
                <ChallengeBlock index={pub.index} name={pub.name} botName={botName} meetStake={meetStake} onVisited={onVisited} />
              </>
            )
          : <div className="px-body" style={{ fontSize: 16, textAlign: 'center' }}>{`Loading pass #${index}…`}</div>}
        <button type="button" className="px-btn-ghost" onClick={onClose}>CLOSE</button>
      </div>
    </div>
  )
}
