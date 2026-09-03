import type { AvatarPhoto, MintStatus } from '../api'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  generate,
  listAvatars,
  mintStatus,
  selectAvatar,
  submitDraft,
  uploadAvatar,
} from '../api'
import { useWalletBind } from '../hooks/useWalletBind'
import { haptic } from '../telegram'

const REVIEW_POLL_MS = 12_000

interface MintFlowProps {
  onBalance: (votes: string) => void
  onMinted: () => void
}

export function MintFlow({ onBalance, onMinted }: MintFlowProps) {
  const [status, setStatus] = useState<MintStatus | null>(null)
  const [picking, setPicking] = useState(false)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    const next = await mintStatus()
    if (next.error) {
      setNotice(next.error)
      return
    }
    setStatus(next)
    onBalance(next.yourVotes)
    if (next.minted) onMinted()
  }, [onBalance, onMinted])

  useEffect(() => {
    void refresh()
  }, [refresh])

  // Poll while the draft sits in admin review.
  useEffect(() => {
    if (status?.state !== 'Submited' || status.minted) return
    const timer = setInterval(() => void refresh(), REVIEW_POLL_MS)
    return () => clearInterval(timer)
  }, [status?.state, status?.minted, refresh])

  const { bindWallet } = useWalletBind(() => void refresh())

  async function onGenerate() {
    if (!status || busy) return
    setBusy(true)
    setNotice(null)
    try {
      const result = await generate()
      if (result.error) {
        setNotice(result.error)
        haptic('error')
      } else {
        onBalance(result.yourVotes)
        haptic('success')
      }
      await refresh()
    } catch {
      setNotice('Network error — nothing was charged twice, check your balance')
    } finally {
      setBusy(false)
    }
  }

  async function onSubmit() {
    if (busy) return
    setBusy(true)
    setNotice(null)
    try {
      const result = await submitDraft()
      if (result.error) {
        setNotice(result.error)
        haptic('error')
      } else {
        haptic('success')
      }
      await refresh()
    } catch {
      setNotice('Network error — try again')
    } finally {
      setBusy(false)
    }
  }

  if (!status) {
    return (
      <div className="px-pulse px-label" style={{ textAlign: 'center', paddingTop: 120 }}>
        LOADING…
      </div>
    )
  }

  if (picking || !status.avatar) {
    return (
      <AvatarPicker
        onDone={async () => {
          setPicking(false)
          await refresh()
        }}
        canCancel={Boolean(status.avatar)}
        onCancel={() => setPicking(false)}
      />
    )
  }

  if (status.state === 'Submited') {
    return <UnderReview image={status.image} />
  }

  const declined = status.state === 'Rework'
  const hasDraft = Boolean(status.image)
  const tryLabel = `${hasDraft ? 'TRY AGAIN' : 'GENERATE'} · ${status.tryCost} $CUBE`

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '18px 16px' }}>
      <div style={{ textAlign: 'center' }}>
        <div className="px-title" style={{ fontSize: 13 }}>FORGE YOUR PASS</div>
        <div className="px-body" style={{ marginTop: 8 }}>
          Every generation try burns $CUBE. Submit the one you love.
        </div>
      </div>

      {declined && (
        <div
          className="px-card"
          style={{ borderColor: 'var(--cw-red)', padding: '10px 12px', textAlign: 'center' }}
        >
          <span style={{ color: 'var(--cw-red-bright)', fontSize: 18 }}>
            DECLINED — forge another look and resubmit
          </span>
        </div>
      )}

      <Stage image={status.image ?? status.avatar} framed={hasDraft} />

      {hasDraft && status.description && (
        <div className="px-body" style={{ textAlign: 'center', color: 'var(--cw-text)' }}>
          {status.description}
        </div>
      )}

      {notice && (
        <div style={{ textAlign: 'center', fontSize: 18, color: 'var(--cw-red-bright)' }}>
          {notice}
        </div>
      )}

      <button
        type="button"
        className="px-btn"
        disabled={busy || !status.canAfford}
        onClick={() => void onGenerate()}
      >
        {busy ? 'WORKING…' : tryLabel}
      </button>
      {!status.canAfford && (
        <div style={{ textAlign: 'center', fontSize: 18, color: 'var(--cw-text-dim)' }}>
          Not enough $CUBE — earn some in the EARN tab
        </div>
      )}

      {hasDraft
        && (status.hasWallet
          ? (
              <button
                type="button"
                className="px-btn"
                disabled={busy}
                onClick={() => void onSubmit()}
              >
                SUBMIT FOR MINT
              </button>
            )
          : (
              <button
                type="button"
                className="px-btn-ghost"
                onClick={() => void bindWallet()}
              >
                CONNECT WALLET TO SUBMIT
              </button>
            ))}

      <button type="button" className="px-btn-ghost" onClick={() => setPicking(true)}>
        CHANGE AVATAR
      </button>
    </div>
  )
}

function Stage({ image, framed }: { image: string | null, framed: boolean }) {
  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 22,
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          border: '2px solid var(--cw-border)',
          boxShadow: 'inset 0 0 40px rgba(0,0,0,.7)',
        }}
      />
      <Torch side="left" />
      <Torch side="right" />
      {image
        ? (
            <img
              src={image}
              alt="avatar"
              style={{
                width: 240,
                height: 240,
                imageRendering: framed ? 'pixelated' : 'auto',
                border: `3px solid ${framed ? 'var(--cw-gold-dark)' : 'var(--cw-border)'}`,
                display: 'block',
              }}
            />
          )
        : (
            <div className="px-label" style={{ padding: 60 }}>NO IMAGE</div>
          )}
    </div>
  )
}

function Torch({ side }: { side: 'left' | 'right' }) {
  return (
    <div
      style={{
        position: 'absolute',
        [side]: 10,
        top: 14,
        width: 10,
        height: 14,
        background: '#ff8c2e',
        boxShadow: '0 0 20px 8px rgba(255,120,30,.35)',
        animation: `cwTorch ${side === 'left' ? 1.1 : 1.3}s steps(3) infinite`,
      }}
    />
  )
}

function UnderReview({ image }: { image: string | null }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '26px 16px', textAlign: 'center' }}>
      <div className="px-title" style={{ fontSize: 13 }}>UNDER REVIEW</div>
      {image && (
        <img
          src={image}
          alt="submitted draft"
          style={{
            width: 240,
            height: 240,
            margin: '0 auto',
            imageRendering: 'pixelated',
            border: '3px solid var(--cw-gold-dark)',
          }}
        />
      )}
      <div className="px-pulse px-label" style={{ fontSize: 10, color: 'var(--cw-gold)' }}>
        AWAITING THE COUNCIL…
      </div>
      <div className="px-body">
        An admin is judging your cube. You will get a Telegram message with the
        verdict — approved passes are minted straight to your wallet.
      </div>
    </div>
  )
}

interface AvatarPickerProps {
  onDone: () => Promise<void>
  canCancel: boolean
  onCancel: () => void
}

function AvatarPicker({ onDone, canCancel, onCancel }: AvatarPickerProps) {
  const [photos, setPhotos] = useState<AvatarPhoto[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    void listAvatars()
      .then((result) => setPhotos(result.error ? [] : result.photos))
      .catch(() => setPhotos([]))
  }, [])

  async function pick(index: number) {
    if (busy) return
    setBusy(true)
    setNotice(null)
    try {
      const result = await selectAvatar(index)
      if (result.error) setNotice(result.error)
      else await onDone()
    } catch {
      setNotice('Network error — try again')
    } finally {
      setBusy(false)
    }
  }

  async function upload(file: File) {
    if (busy) return
    setBusy(true)
    setNotice(null)
    try {
      const result = await uploadAvatar(file)
      if (result.error) setNotice(result.error)
      else await onDone()
    } catch {
      setNotice('Upload failed — JPEG/PNG up to 8 MB')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '18px 16px' }}>
      <div style={{ textAlign: 'center' }}>
        <div className="px-title" style={{ fontSize: 13 }}>CHOOSE YOUR FACE</div>
        <div className="px-body" style={{ marginTop: 8 }}>
          It becomes the soul of your pixel pass
        </div>
      </div>

      {photos === null && (
        <div className="px-pulse px-label" style={{ textAlign: 'center', padding: 40 }}>
          SUMMONING YOUR PORTRAITS…
        </div>
      )}

      {photos !== null && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 10,
          }}
        >
          {photos.map((photo) => (
            <button
              key={photo.index}
              type="button"
              disabled={busy}
              onClick={() => void pick(photo.index)}
              style={{
                padding: 0,
                cursor: 'pointer',
                background: 'var(--cw-bg-panel)',
                border: '2px solid var(--cw-border)',
                aspectRatio: '1',
              }}
            >
              <img
                src={photo.dataUrl}
                alt={`profile ${photo.index + 1}`}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
            </button>
          ))}
          <button
            type="button"
            disabled={busy}
            onClick={() => fileInput.current?.click()}
            className="px-label"
            style={{
              cursor: 'pointer',
              background: 'var(--cw-bg-panel)',
              border: '2px solid var(--cw-border)',
              aspectRatio: '1',
              color: 'var(--cw-gold)',
            }}
          >
            + UPLOAD
          </button>
        </div>
      )}

      {photos !== null && photos.length === 0 && (
        <div className="px-body" style={{ textAlign: 'center' }}>
          No Telegram profile photos found — upload any square-ish JPEG/PNG.
        </div>
      )}

      {notice && (
        <div style={{ textAlign: 'center', fontSize: 18, color: 'var(--cw-red-bright)' }}>
          {notice}
        </div>
      )}
      {busy && (
        <div className="px-pulse px-label" style={{ textAlign: 'center' }}>WORKING…</div>
      )}

      {canCancel && (
        <button type="button" className="px-btn-ghost" onClick={onCancel}>
          BACK
        </button>
      )}

      <input
        ref={fileInput}
        type="file"
        accept="image/jpeg,image/png"
        style={{ display: 'none' }}
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) void upload(file)
          event.target.value = ''
        }}
      />
    </div>
  )
}
