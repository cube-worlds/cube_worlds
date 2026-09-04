import type { PassPublic } from '../api'
import { useEffect, useState } from 'react'
import { worldPass } from '../api'
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

// Modal peek at another holder's pass.
export function PassPeek({ index, onClose }: { index: number, onClose: () => void }) {
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
              </>
            )
          : <div className="px-body" style={{ fontSize: 16, textAlign: 'center' }}>{`Loading pass #${index}…`}</div>}
        <button type="button" className="px-btn-ghost" onClick={onClose}>CLOSE</button>
      </div>
    </div>
  )
}
