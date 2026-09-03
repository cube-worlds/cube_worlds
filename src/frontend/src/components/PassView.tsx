import type { MintStatus } from '../api'
import { useEffect, useState } from 'react'
import { mintStatus } from '../api'
import { CubeEmblem } from './CubeEmblem'

// The minted holder's view: their pass + the locked gates of World I.
export function PassView() {
  const [status, setStatus] = useState<MintStatus | null>(null)

  useEffect(() => {
    void mintStatus()
      .then((result) => {
        if (!result.error) setStatus(result)
      })
      .catch(() => {})
  }, [])

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 16,
        padding: '26px 16px',
        textAlign: 'center',
      }}
    >
      <div className="px-title" style={{ fontSize: 13 }}>PASS HOLDER</div>

      {status?.image
        ? (
            <img
              src={status.image}
              alt="your pass"
              style={{
                width: 240,
                height: 240,
                imageRendering: 'pixelated',
                border: '3px solid var(--cw-gold-dark)',
                boxShadow: '0 0 0 6px var(--cw-bg), 0 24px 60px rgba(0,0,0,.8)',
              }}
            />
          )
        : (
            <CubeEmblem size={120} />
          )}

      {status?.description && (
        <div className="px-body" style={{ color: 'var(--cw-text)', maxWidth: 300 }}>
          {status.description}
        </div>
      )}

      {status?.nftUrl && (
        <a
          href={status.nftUrl}
          target="_blank"
          rel="noreferrer"
          className="px-label"
          style={{ color: 'var(--cw-gold)' }}
        >
          VIEW NFT ON GETGEMS ↗
        </a>
      )}

      <div
        className="px-card"
        style={{ width: '100%', padding: '18px 12px', marginTop: 8 }}
      >
        <div className="px-label" style={{ color: 'var(--cw-gold)' }}>WORLD I</div>
        <div className="px-pulse px-label" style={{ marginTop: 12, fontSize: 10 }}>
          THE GATES ARE SEALED…
        </div>
        <div className="px-body" style={{ marginTop: 10 }}>
          Your pass is forged. The Shattered Realm opens to holders first —
          watch @cube_worlds for the signal.
        </div>
      </div>
    </div>
  )
}
