import { useEffect, useState } from 'react'
import { useWalletBind } from '../hooks/useWalletBind'
import { haptic } from '../telegram'

type WalletState = 'idle' | 'connecting' | 'rejected' | 'bound' | 'taken'

interface WalletScreenProps {
  reason: 'forge' | 'pass'
  wallet?: string
  onBound: (address: string) => void
  onContinue: () => void
  onBack: () => void
}

export function shortAddress(address: string): string {
  return `${address.slice(0, 4)}…${address.slice(-4)}`
}

const REASON_COPY = {
  forge: 'Your minted pass needs a home. Bind the TON wallet that will receive it. We only read it; the proof shows you own it.',
  pass: 'Connect the wallet that holds your Cube Worlds NFT. We only read it; the proof shows you own it.',
}

// Shared by forge-submit and have-a-pass. TON Connect owns the modal; this is
// our before/after chrome around it.
export function WalletScreen({ reason, wallet, onBound, onContinue, onBack }: WalletScreenProps) {
  const [state, setState] = useState<WalletState>(wallet ? 'bound' : 'idle')
  const [address, setAddress] = useState<string | undefined>(wallet)

  const { bindWallet, tonConnectUI } = useWalletBind(
    (bound) => {
      setAddress(bound)
      setState('bound')
      haptic('success')
      onBound(bound)
    },
    (result) => {
      setState(result.code === 'wallet_taken' ? 'taken' : 'rejected')
      haptic('error')
    },
  )

  // Modal dismissed without picking a wallet → back to idle (or bound).
  // Verified against @tonconnect/ui's shipped `index.d.ts`:
  // `onModalStateChange` yields `WalletsModalState`, whose closed variant is
  // `{ status: 'closed', closeReason: WalletsModalCloseReason | null }` and
  // `WalletsModalCloseReason = 'action-cancelled' | 'wallet-selected'`.
  useEffect(() => {
    return tonConnectUI.onModalStateChange((modal) => {
      if (modal.status === 'closed' && modal.closeReason === 'action-cancelled') {
        setState(address ? 'bound' : 'idle')
      }
    })
  }, [tonConnectUI, address])

  function connect() {
    setState('connecting')
    void bindWallet()
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 14, padding: '20px 20px 24px', minHeight: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button type="button" className="px-back" onClick={onBack}>‹ BACK</button>
        <div className="px-step">{reason === 'forge' ? 'FORGE · 3/3' : 'HAVE A PASS · 1/2'}</div>
      </div>
      <div className="px-title" style={{ fontSize: 14, lineHeight: 1.6 }}>BIND A TON WALLET</div>
      <div className="px-body" style={{ color: 'var(--cw-text)', fontSize: 19 }}>{REASON_COPY[reason]}</div>

      {state === 'bound' && address && (
        <div className="px-card" style={{ borderColor: 'var(--cw-green)', padding: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div className="px-label" style={{ color: 'var(--cw-green)' }}>BOUND · PROOF OK</div>
            <div style={{ fontSize: 20, color: 'var(--cw-text)', marginTop: 4 }}>{shortAddress(address)}</div>
          </div>
          <button type="button" className="px-btn-ghost" style={{ width: 'auto', padding: '8px 10px', fontSize: 7 }} onClick={connect}>
            REBIND
          </button>
        </div>
      )}

      {state === 'connecting' && (
        <div style={{ border: '2px dashed var(--cw-border)', background: 'var(--cw-bg-deep)', padding: 16, textAlign: 'center' }}>
          <div className="px-pulse px-label" style={{ color: 'var(--cw-gold)' }}>WAITING FOR WALLET…</div>
          <div className="px-body" style={{ marginTop: 8, fontSize: 17 }}>
            TON Connect modal is open. Approve in your wallet and sign the proof.
          </div>
        </div>
      )}

      {state === 'rejected' && (
        <div className="px-card" style={{ borderColor: 'var(--cw-red)', padding: 14 }}>
          <div className="px-label" style={{ color: 'var(--cw-red-bright)' }}>PROOF REJECTED</div>
          <div className="px-body" style={{ marginTop: 6 }}>The wallet did not sign a valid proof. Try again.</div>
        </div>
      )}

      {state === 'taken' && (
        <div className="px-card" style={{ borderColor: 'var(--cw-red)', padding: 14 }}>
          <div className="px-label" style={{ color: 'var(--cw-red-bright)' }}>WALLET ALREADY BOUND</div>
          <div className="px-body" style={{ marginTop: 6 }}>This wallet belongs to another account. Use another wallet.</div>
        </div>
      )}

      <div style={{ flex: 1 }} />

      {state === 'bound'
        ? (
            <button type="button" className="px-btn" onClick={onContinue}>
              {reason === 'forge' ? 'BACK TO THE FORGE' : 'SCAN FOR PASSES'}
            </button>
          )
        : (
            <button type="button" className="px-btn-blue" disabled={state === 'connecting'} onClick={connect}>
              ◆ CONNECT WALLET
            </button>
          )}
      <div className="px-body" style={{ textAlign: 'center', fontSize: 16, color: 'var(--cw-text-faint)' }}>
        Tonkeeper · MyTonWallet · Telegram Wallet
      </div>
    </div>
  )
}
