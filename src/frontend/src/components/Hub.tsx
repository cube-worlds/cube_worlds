import type { Pass, VisitView } from '../api'
import { useEffect, useState } from 'react'
import { worldState } from '../api'
import { DailyClaim } from './DailyClaim'
import { PassImage } from './PassScan'

interface HubProps {
  pass: Pass
  username: string | null
  onBalance: (votes: string) => void
  onBali: () => void
  onHero: () => void
  onEarn: () => void
}

// Hub shell: hero card, daily claim, BALI activity, shortcuts.
export function Hub({ pass, username, onBalance, onBali, onHero, onEarn }: HubProps) {
  const [outcome, setOutcome] = useState<VisitView | null>(null)
  useEffect(() => {
    void worldState().then((s) => {
      if (s.error || !s.lastOutcome) return
      if (sessionStorage.getItem('cw.lastOutcomeSeen') === s.lastOutcome.id) return
      setOutcome(s.lastOutcome)
    }).catch(() => {})
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '16px 16px 20px' }}>
      <div className="px-step" style={{ letterSpacing: 1 }}>BALI · THE ISLAND OF TRAITS</div>

      <div className="px-card" style={{ borderColor: 'var(--cw-gold-deep)', boxShadow: '0 6px 0 var(--cw-border-dark)', padding: 14, display: 'flex', gap: 14 }}>
        <PassImage src={pass.image} size={110} border="3px solid var(--cw-gold-dark)" />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6, justifyContent: 'center' }}>
          <div className="px-title" style={{ fontSize: 10, lineHeight: 1.5 }}>{username ? `@${username}` : pass.name}</div>
          <div className="px-label" style={{ fontSize: 7 }}>{`PASS #${pass.index}`}</div>
          <div style={{ fontSize: 17, color: 'var(--cw-text-dim)', marginTop: 6 }}>{pass.name}</div>
        </div>
      </div>

      {outcome && (
        <div className="px-card" style={{ borderColor: 'var(--cw-gold)', padding: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div className="px-label" style={{ fontSize: 7 }}>LAST WINDOW</div>
          <div className="px-body" style={{ fontSize: 16 }}>{outcome.outcome}</div>
          {Number(outcome.payout) > 0 && (
            <div className="px-label" style={{ fontSize: 7, color: 'var(--cw-green)' }}>{`+${outcome.payout} $CUBE`}</div>
          )}
          <button type="button" className="px-btn-ghost" onClick={() => { sessionStorage.setItem('cw.lastOutcomeSeen', outcome.id); setOutcome(null) }}>OK</button>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div className="px-card" style={{ boxShadow: '0 4px 0 var(--cw-border-dark)', padding: 12 }}>
          <div className="px-label" style={{ fontSize: 7, marginBottom: 8 }}>DAILY CLAIM</div>
          <DailyClaim onBalance={onBalance} />
        </div>
        <div className="px-card" style={{ borderColor: 'var(--cw-green)', boxShadow: '0 4px 0 var(--cw-border-dark)', padding: 12, display: 'flex', flexDirection: 'column', gap: 8, cursor: 'pointer' }} onClick={onBali}>
          <div className="px-label" style={{ fontSize: 7 }}>THE ISLAND</div>
          <div className="px-title" style={{ fontSize: 9, color: 'var(--cw-green)', lineHeight: 1.6 }}>BALI</div>
          <div className="px-body" style={{ fontSize: 16 }}>One visit per 8 hours. Your traits decide.</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Shortcut icon="▣" color="var(--cw-purple)" label="HERO" onClick={onHero} />
        <Shortcut icon="◆" color="var(--cw-green)" label="EARN" onClick={onEarn} />
      </div>
    </div>
  )
}

function Shortcut({ icon, color, label, onClick }: { icon: string, color: string, label: string, onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-label"
      style={{ background: 'var(--cw-bg-panel-2)', border: '2px solid var(--cw-border)', boxShadow: '0 4px 0 var(--cw-border-dark)', padding: '12px 6px', cursor: 'pointer', color: 'var(--cw-text)', fontSize: 7, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}
    >
      <span style={{ fontSize: 14, color }}>{icon}</span>
      {label}
    </button>
  )
}
