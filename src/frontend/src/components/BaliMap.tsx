import type { PlaceView } from '../api'
import { BALI, GILI, LEMBONGAN, MAP_H, MAP_W, PENIDA, project, toPath } from './bali-geo'

interface BaliMapProps {
  places: PlaceView[]
  myPlace: string | null
  selected: string | null
  onSelect: (id: string) => void
}

// One SVG: sea, islands, fourteen nodes. Open places gold, "soon" dim,
// my current visit pulses.
export function BaliMap({ places, myPlace, selected, onSelect }: BaliMapProps) {
  return (
    <svg viewBox={`0 0 ${MAP_W} ${MAP_H}`} width="100%" style={{ display: 'block', background: '#0b1a2a', border: '2px solid var(--cw-border-dark)', shapeRendering: 'crispEdges' }}>
      {[BALI, PENIDA, LEMBONGAN, GILI].map((poly, i) => (
        <path key={i} d={toPath(poly)} fill="#241a2e" stroke="#3a2a4a" strokeWidth={2} />
      ))}
      {places.map((p) => {
        const { x, y } = project(p.lat, p.lon)
        const mine = p.id === myPlace
        const active = p.id === selected
        const fill = !p.open ? 'var(--cw-text-faint)' : mine ? 'var(--cw-green)' : 'var(--cw-gold)'
        return (
          <g key={p.id} onClick={() => onSelect(p.id)} style={{ cursor: 'pointer' }}>
            <rect x={x - 6} y={y - 6} width={12} height={12} fill={fill} stroke={active ? '#fff' : '#000'} strokeWidth={2} className={mine ? 'px-pulse' : undefined} />
            <text x={x} y={y - 10} textAnchor="middle" fontFamily="var(--font-pixel)" fontSize={6} fill={p.open ? 'var(--cw-text)' : 'var(--cw-text-faint)'}>
              {p.name.toUpperCase()}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
