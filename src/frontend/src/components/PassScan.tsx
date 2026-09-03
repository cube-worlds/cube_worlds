import type { LoginResponse, Pass } from '../api'
import { useCallback, useEffect, useState } from 'react'
import { scanPasses, selectPass } from '../api'
import { haptic } from '../telegram'
import { shortAddress } from './WalletScreen'

type ScanState =
  | { kind: 'scanning' }
  | { kind: 'found', passes: Pass[] }
  | { kind: 'none' }
  | { kind: 'failed', message: string }

interface PassScanProps {
  wallet: string
  minted: boolean
  onSelected: (user: LoginResponse) => void
  onForge: () => void
  onSwitchWallet: () => void
  onBack: () => void
}

export function PassImage({ src, size, border = '2px solid var(--cw-gold-deep)' }: { src: string, size: number | string, border?: string }) {
  return src
    ? (
        <img
          src={src}
          alt="pass"
          style={{ width: size, height: size, imageRendering: 'pixelated', border, background: 'var(--cw-bg-deep)', display: 'block', objectFit: 'cover' }}
        />
      )
    : (
        <div className="px-title" style={{ width: size, height: size, border, background: 'var(--cw-bg-deep)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, color: 'var(--cw-border)' }}>
          ?
        </div>
      )
}

export function PassScan({ wallet, minted, onSelected, onForge, onSwitchWallet, onBack }: PassScanProps) {
  const [state, setState] = useState<ScanState>({ kind: 'scanning' })
  const [selected, setSelected] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const scan = useCallback(async () => {
    setState({ kind: 'scanning' })
    setSelected(null)
    try {
      const result = await scanPasses()
      if (result.error) {
        setState({ kind: 'failed', message: result.error })
        return
      }
      if (result.passes.length === 0) {
        setState({ kind: 'none' })
        return
      }
      setState({ kind: 'found', passes: result.passes })
      if (result.passes.length === 1) setSelected(result.passes[0].index)
    } catch {
      setState({ kind: 'failed', message: 'Network error' })
    }
  }, [])

  useEffect(() => {
    void scan()
  }, [scan])

  async function play() {
    if (selected === null || busy) return
    setBusy(true)
    setNotice(null)
    try {
      const result = await selectPass(selected)
      if (result.error) {
        setNotice(result.code === 'not_owned' ? 'That pass left the wallet — rescanning' : result.error)
        haptic('error')
        if (result.code === 'not_owned') await scan()
        return
      }
      haptic('success')
      onSelected(result)
    } catch {
      setNotice('Network error — try again')
    } finally {
      setBusy(false)
    }
  }

  if (state.kind === 'scanning') {
    return (
      <Centered>
        <div className="px-spin" />
        <div className="px-title" style={{ fontSize: 12, lineHeight: 1.7, textAlign: 'center' }}>
          SCANNING
          <br />
          {shortAddress(wallet)}
        </div>
        <div className="px-pulse px-label">LOOKING FOR PASSES…</div>
      </Centered>
    )
  }

  if (state.kind === 'failed') {
    return (
      <Centered>
        <div className="px-title" style={{ fontSize: 12, color: 'var(--cw-red-bright)', textAlign: 'center', lineHeight: 1.7 }}>
          COULD NOT READ
          <br />
          THE WALLET
        </div>
        <div className="px-body" style={{ textAlign: 'center' }}>{state.message}</div>
        <button type="button" className="px-btn" onClick={() => void scan()}>RETRY</button>
        <button type="button" className="px-back" onClick={onBack}>‹ WALLET</button>
      </Centered>
    )
  }

  if (state.kind === 'none') {
    return (
      <Centered>
        <PassImage src="" size={120} border="3px dashed var(--cw-border)" />
        {minted
          ? (
              <>
                <div className="px-title" style={{ fontSize: 12, color: 'var(--cw-text)', textAlign: 'center', lineHeight: 1.7 }}>
                  PASS NOT INDEXED YET
                </div>
                <div className="px-body" style={{ textAlign: 'center' }}>
                  Your pass is being indexed, try again in a minute.
                </div>
                <button type="button" className="px-btn" onClick={() => void scan()}>SCAN AGAIN</button>
              </>
            )
          : (
              <>
                <div className="px-title" style={{ fontSize: 12, color: 'var(--cw-text)', textAlign: 'center', lineHeight: 1.7 }}>
                  NO CUBE WORLDS PASS
                  <br />
                  IN THIS WALLET
                </div>
                <div className="px-body" style={{ textAlign: 'center' }}>
                  {shortAddress(wallet)}
                  {' '}
                  · 0 of collection
                </div>
                <a href="https://getgems.io/cubeworlds" target="_blank" rel="noreferrer" className="px-btn-blue">BUY ON GETGEMS ›</a>
                <button type="button" className="px-btn-ghost" onClick={onForge}>FORGE A NEW PASS INSTEAD</button>
              </>
            )}
        <button type="button" className="px-back" onClick={onSwitchWallet}>SWITCH WALLET</button>
      </Centered>
    )
  }

  const { passes } = state
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 14, padding: 20, minHeight: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button type="button" className="px-back" onClick={onBack}>‹ WALLET</button>
        <div className="px-step">{shortAddress(wallet)}</div>
      </div>
      <div className="px-title" style={{ fontSize: 14, lineHeight: 1.6 }}>
        {passes.length === 1 ? 'ONE PASS FOUND' : `${passes.length} PASSES FOUND`}
      </div>
      <div className="px-body" style={{ color: 'var(--cw-text)', fontSize: 19 }}>
        Pick one to play as. You can switch later from HERO.
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {passes.map((pass) => (
          <button
            key={pass.index}
            type="button"
            className="px-card"
            onClick={() => setSelected(pass.index)}
            style={{
              padding: 10,
              cursor: 'pointer',
              color: 'inherit',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              alignItems: 'center',
              borderColor: selected === pass.index ? 'var(--cw-gold)' : 'var(--cw-border)',
              boxShadow: '0 4px 0 var(--cw-border-dark)',
            }}
          >
            <PassImage src={pass.image} size="100%" />
            <div className="px-label" style={{ color: 'var(--cw-gold)' }}>{`#${pass.index}`}</div>
            <div style={{ fontSize: 17, color: 'var(--cw-text)' }}>{pass.name}</div>
          </button>
        ))}
      </div>
      {notice && <div style={{ textAlign: 'center', fontSize: 18, color: 'var(--cw-red-bright)' }}>{notice}</div>}
      <div style={{ flex: 1 }} />
      <button type="button" className="px-btn" disabled={selected === null || busy} onClick={() => void play()}>
        {busy ? 'ENTERING…' : selected === null ? 'PICK A PASS' : `PLAY AS #${selected}`}
      </button>
    </div>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18, padding: 24, minHeight: '100%' }}>
      {children}
    </div>
  )
}
