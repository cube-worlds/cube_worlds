import { CubeEmblem } from './CubeEmblem'

const STARS = [
  { x: 40, y: 60, dur: 2.1 },
  { x: 120, y: 30, dur: 1.7 },
  { x: 200, y: 80, dur: 2.5 },
  { x: 290, y: 44, dur: 1.9 },
  { x: 340, y: 110, dur: 2.3 },
  { x: 70, y: 150, dur: 2.7 },
  { x: 250, y: 160, dur: 1.5 },
  { x: 330, y: 210, dur: 2.2 },
  { x: 30, y: 250, dur: 1.8 },
  { x: 160, y: 220, dur: 2.6 },
]

interface TitleScreenProps {
  phase: 'loading' | 'ready' | 'error'
  error?: string
  onEnter: () => void
  onRetry: () => void
}

export function TitleScreen({ phase, error, onEnter, onRetry }: TitleScreenProps) {
  return (
    <div
      onClick={phase === 'ready' ? onEnter : undefined}
      style={{
        position: 'fixed',
        inset: 0,
        cursor: phase === 'ready' ? 'pointer' : 'default',
        overflow: 'hidden',
        background:
          'linear-gradient(180deg, #0a0714 0%, #140d1e 45%, #241226 78%, #3d1a1c 100%)',
      }}
    >
      {STARS.map((s) => (
        <div
          key={`${s.x}-${s.y}`}
          style={{
            position: 'absolute',
            width: 3,
            height: 3,
            background: '#cbbfd8',
            left: s.x,
            top: s.y,
            animation: `cwPulse ${s.dur}s steps(2) infinite`,
          }}
        />
      ))}

      <div
        style={{
          position: 'absolute',
          bottom: 170,
          left: 0,
          right: 0,
          height: 120,
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center',
          gap: 6,
          opacity: 0.55,
        }}
      >
        {[
          [34, 52],
          [22, 84],
          [46, 64],
          [26, 104],
          [40, 70],
          [20, 90],
        ].map(([w, h], i) => (
          <div
            key={w * 1000 + h}
            style={{
              width: w,
              height: h,
              background: i % 2 === 0 ? '#120b18' : '#150d1c',
            }}
          />
        ))}
      </div>

      <div
        style={{
          position: 'absolute',
          top: 96,
          left: '50%',
          marginLeft: -44,
        }}
      >
        <CubeEmblem />
      </div>

      <div style={{ position: 'absolute', top: 214, left: 0, right: 0, textAlign: 'center' }}>
        <div
          className="px-title"
          style={{
            fontSize: 26,
            textShadow: '0 4px 0 #5a3d10, 0 8px 0 rgba(0,0,0,.6)',
            letterSpacing: 2,
          }}
        >
          CUBE
        </div>
        <div
          className="px-title"
          style={{
            fontSize: 26,
            textShadow: '0 4px 0 #5a3d10, 0 8px 0 rgba(0,0,0,.6)',
            letterSpacing: 2,
            marginTop: 10,
          }}
        >
          WORLDS
        </div>
        <div
          style={{
            fontSize: 19,
            color: '#9a8fb0',
            marginTop: 14,
            letterSpacing: 3,
            whiteSpace: 'nowrap',
          }}
        >
          CHRONICLES OF THE SHATTERED REALM
        </div>
      </div>

      <div style={{ position: 'absolute', bottom: 118, left: 16, right: 16, textAlign: 'center' }}>
        {phase === 'loading' && (
          <div className="px-pulse" style={{ fontFamily: 'var(--font-pixel)', fontSize: 11, color: '#cbbfd8' }}>
            ENTERING THE REALM…
          </div>
        )}
        {phase === 'ready' && (
          <div className="px-pulse" style={{ fontFamily: 'var(--font-pixel)', fontSize: 11, color: '#cbbfd8' }}>
            TAP TO ENTER
          </div>
        )}
        {phase === 'error' && (
          <div className="px-card" style={{ borderColor: 'var(--cw-red)', padding: 12 }}>
            <div className="px-label" style={{ color: 'var(--cw-red-bright)' }}>REALM UNREACHABLE</div>
            <div className="px-body" style={{ marginTop: 6 }}>{error ?? 'Open the app from Telegram.'}</div>
            <button
              type="button"
              className="px-btn"
              style={{ marginTop: 10, padding: '10px 0', fontSize: 9 }}
              onClick={(event) => {
                event.stopPropagation()
                onRetry()
              }}
            >
              RETRY
            </button>
          </div>
        )}
      </div>

      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 44,
          background: '#1a0e10',
          borderTop: '4px solid #3d1a1c',
        }}
      />
    </div>
  )
}
