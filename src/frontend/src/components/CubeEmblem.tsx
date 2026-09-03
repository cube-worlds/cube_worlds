// The floating cube emblem from the design handoff: gold isometric cube with a
// glowing red core. Pure CSS pixel-art, no assets.

export function CubeEmblem({ size = 88 }: { size?: number }) {
  const s = size / 88
  return (
    <div
      className="px-float"
      style={{ position: 'relative', width: 88 * s, height: 88 * s }}
    >
      <div
        style={{
          position: 'absolute',
          left: 14 * s,
          top: 0,
          width: 60 * s,
          height: 30 * s,
          background: '#e0b83e',
          clipPath: 'polygon(50% 0, 100% 50%, 50% 100%, 0 50%)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 14 * s,
          top: 15 * s,
          width: 30 * s,
          height: 44 * s,
          background: '#8a6a1c',
          transform: 'skewY(26.57deg)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 44 * s,
          top: 15 * s,
          width: 30 * s,
          height: 44 * s,
          background: '#b8902a',
          transform: 'skewY(-26.57deg)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 34 * s,
          top: 26 * s,
          width: 20 * s,
          height: 20 * s,
          background: '#4a0f10',
          boxShadow: `0 0 ${18 * s}px ${6 * s}px rgba(200,40,30,.45)`,
        }}
      />
    </div>
  )
}
