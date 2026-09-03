import type { Pass } from '../api'
import { DailyClaim } from './DailyClaim'
import { PassImage } from './PassScan'

interface HubProps {
  pass: Pass
  username: string | null
  onBalance: (votes: string) => void
  onHero: () => void
  onEarn: () => void
}

// Hub shell: hero card, daily claim, "World I coming" activity, shortcuts.
export function Hub({ pass, username, onBalance, onHero, onEarn }: HubProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '16px 16px 20px' }}>
      <div className="px-step" style={{ letterSpacing: 1 }}>WORLD I · THE HOLLOW KEEP</div>

      <div className="px-card" style={{ borderColor: 'var(--cw-gold-deep)', boxShadow: '0 6px 0 var(--cw-border-dark)', padding: 14, display: 'flex', gap: 14 }}>
        <PassImage src={pass.image} size={110} border="3px solid var(--cw-gold-dark)" />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6, justifyContent: 'center' }}>
          <div className="px-title" style={{ fontSize: 10, lineHeight: 1.5 }}>{username ? `@${username}` : pass.name}</div>
          <div className="px-label" style={{ fontSize: 7 }}>{`PASS #${pass.index}`}</div>
          <div style={{ fontSize: 17, color: 'var(--cw-text-dim)', marginTop: 6 }}>{pass.name}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div className="px-card" style={{ boxShadow: '0 4px 0 var(--cw-border-dark)', padding: 12 }}>
          <div className="px-label" style={{ fontSize: 7, marginBottom: 8 }}>DAILY CLAIM</div>
          <DailyClaim onBalance={onBalance} />
        </div>
        <div className="px-card" style={{ borderColor: 'var(--cw-purple)', boxShadow: '0 4px 0 var(--cw-border-dark)', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="px-label" style={{ fontSize: 7 }}>ACTIVITY</div>
          <div className="px-title" style={{ fontSize: 9, color: 'var(--cw-purple)', lineHeight: 1.6 }}>WORLD I · COMING</div>
          <div style={{ fontSize: 22, color: 'var(--cw-text)', letterSpacing: 1 }}>SOON</div>
          <div className="px-body" style={{ fontSize: 16 }}>Holders enter first. Keep your $CUBE ready.</div>
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
