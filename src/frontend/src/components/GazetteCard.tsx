import type { Gazette, GazetteLine } from '../api'
import { useState } from 'react'

function hhmm(ms: number): string {
  return `${String(new Date(ms).getUTCHours()).padStart(2, '0')}:00`
}

const NAME_BTN: React.CSSProperties = { background: 'none', border: 'none', padding: 0, color: 'var(--cw-gold)', font: 'inherit', textDecoration: 'underline', cursor: 'pointer' }

// "{0} robbed {1}" → text with each named pass as a tappable name.
export function GazetteText({ line, onPeek }: { line: GazetteLine, onPeek: (pass: number) => void }) {
  const parts = line.text.split(/(\{\d+\})/)
  return (
    <span>
      {parts.map((part, i) => {
        const m = /^\{(\d+)\}$/.exec(part)
        if (!m) return <span key={i}>{part}</span>
        const named = line.passes[Number(m[1])]
        if (!named) return <span key={i}>?</span>
        if (named.pass < 0) return <span key={i}>{named.name}</span>
        return <button key={i} type="button" style={NAME_BTN} onClick={() => onPeek(named.pass)}>{named.name}</button>
      })}
    </span>
  )
}

// LAST WINDOW: collapsed header + fox; tap to open every place's lines.
export function GazetteCard({ gazette, onPeek }: { gazette: Gazette, onPeek: (pass: number) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="px-card" style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <button type="button" onClick={() => setOpen(o => !o)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', color: 'inherit', textAlign: 'left' }}>
        <span className="px-label" style={{ fontSize: 7 }}>{`LAST WINDOW · ${hhmm(gazette.startsAt)}–${hhmm(gazette.endsAt)} UTC · ${gazette.pilgrims} PILGRIMS`}</span>
        <span className="px-label" style={{ fontSize: 7, color: 'var(--cw-gold)' }}>{open ? '▲' : '▼'}</span>
      </button>
      {gazette.fox && (
        <div className="px-body" style={{ fontSize: 16 }}>
          {'🦊 Fox of the window: '}
          <GazetteText line={{ text: `{0} +${gazette.fox.net}`, passes: [gazette.fox] }} onPeek={onPeek} />
        </div>
      )}
      {open && gazette.places.map(p => (
        <div key={p.place} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div className="px-label" style={{ fontSize: 7, color: 'var(--cw-gold)' }}>{`${p.name.toUpperCase()} · ${p.visitors}`}</div>
          {p.lines.map((l, i) => (
            <div key={i} className="px-body" style={{ fontSize: 16 }}><GazetteText line={l} onPeek={onPeek} /></div>
          ))}
        </div>
      ))}
    </div>
  )
}
