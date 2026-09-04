import type { Pass } from '../api'
import { PassPublicBlock, usePublicPass } from './PassPeek'
import { PassImage } from './PassScan'
import { shortAddress } from './WalletScreen'

interface HeroTabProps {
  pass: Pass
  wallet?: string
  collectionAddress?: string
  onSwitchPass: () => void
}

// Pass detail, on-chain links, Bali reputation and top traits.
export function HeroTab({ pass, wallet, collectionAddress, onSwitchPass }: HeroTabProps) {
  const pub = usePublicPass(pass.index)

  const getgems = collectionAddress
    ? `https://getgems.io/collection/${collectionAddress}/${pass.address}`
    : 'https://getgems.io/cubeworlds'
  // ponytail: mainnet explorer only; expose TESTNET in /api/public/config if a testnet link is ever needed.
  const explorer = `https://tonviewer.com/${pass.address}`

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '16px 16px 20px' }}>
      <div className="px-title" style={{ fontSize: 12 }}>HERO</div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
        <PassImage src={pass.image} size={170} border="4px solid var(--cw-gold-dark)" />
        <div className="px-title" style={{ fontSize: 11 }}>{pass.name}</div>
        <div className="px-label" style={{ fontSize: 7 }}>{`CUBE WORLDS PASS #${pass.index}`}</div>
      </div>

      <div style={{ background: 'var(--cw-bg-deep)', border: '2px solid var(--cw-border-dark)', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div className="px-label" style={{ fontSize: 7 }}>ON-CHAIN</div>
        <div style={{ fontSize: 16, color: 'var(--cw-text)', wordBreak: 'break-all' }}>
          {shortAddress(pass.address)}
          {wallet ? ` · owner ${shortAddress(wallet)}` : ''}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <a href={getgems} target="_blank" rel="noreferrer" className="px-btn-ghost" style={{ flex: 1, fontSize: 7, textDecoration: 'none', color: 'var(--cw-text)' }}>GETGEMS ›</a>
          <a href={explorer} target="_blank" rel="noreferrer" className="px-btn-ghost" style={{ flex: 1, fontSize: 7, textDecoration: 'none', color: 'var(--cw-text)' }}>EXPLORER ›</a>
        </div>
      </div>

      {pub && <PassPublicBlock pub={pub} />}

      <button type="button" className="px-btn-ghost" onClick={onSwitchPass}>SWITCH PASS</button>
    </div>
  )
}
