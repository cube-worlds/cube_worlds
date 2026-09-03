import type { PublicConfig } from '../api'
import { useTonConnectUI } from '@tonconnect/ui-react'
import { useState } from 'react'
import { topupInvoice } from '../api'
import { useWalletBind } from '../hooks/useWalletBind'
import { haptic, openInvoice, openShare } from '../telegram'
import { DailyClaim } from './DailyClaim'

// Three pack sizes; $CUBE per pack is derived from the flat config rate.
const STARS_PACKS = [100, 500, 1000]
const TON_PACKS: Array<{ label: string, nano: string }> = [
  { label: '1 TON', nano: '1000000000' },
  { label: '5 TON', nano: '5000000000' },
  { label: '10 TON', nano: '10000000000' },
]

interface EarnPanelProps {
  balance: string
  userId: number
  hasWallet: boolean
  config: PublicConfig | null
  onBalance: (votes: string) => void
  onWalletBound: () => void
}

export function EarnPanel({
  balance,
  userId,
  hasWallet,
  config,
  onBalance,
  onWalletBound,
}: EarnPanelProps) {
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [tonConnectUI] = useTonConnectUI()
  const { bindWallet } = useWalletBind(onWalletBound)

  async function onTopup(stars: number) {
    if (busy) return
    setBusy(true)
    setNotice(null)
    try {
      const invoice = await topupInvoice(stars)
      if (invoice.error || !invoice.link) {
        setNotice(invoice.error ?? 'Invoice failed')
        return
      }
      const status = await openInvoice(invoice.link)
      if (status === 'paid') {
        haptic('success')
        setNotice('Payment received — $CUBE arrives in a few seconds')
      }
    } catch {
      setNotice('Invoice failed — try again')
    } finally {
      setBusy(false)
    }
  }

  async function onDonate(nano: string) {
    if (!config?.donationAddress) return
    setNotice(null)
    try {
      await tonConnectUI.sendTransaction({
        validUntil: Math.floor(Date.now() / 1000) + 300,
        messages: [{ address: config.donationAddress, amount: nano }],
      })
      setNotice('Donation sent — $CUBE lands after the transaction confirms')
      haptic('success')
    } catch {
      // user closed the wallet — not an error
    }
  }

  const inviteUrl = config ? `https://t.me/${config.botName}?start=${userId}` : ''

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '18px 16px' }}>
      <div style={{ textAlign: 'center' }}>
        <div className="px-label">YOUR HOARD</div>
        <div className="px-title" style={{ fontSize: 22, marginTop: 10 }}>
          {Number(balance).toLocaleString('en-US')}
          {' '}
          $CUBE
        </div>
      </div>

      {notice && (
        <div style={{ textAlign: 'center', fontSize: 18, color: 'var(--cw-gold)' }}>
          {notice}
        </div>
      )}

      <Card title="DAILY CLAIM">
        <DailyClaim onBalance={onBalance} />
      </Card>

      <Card title="INVITE FRIENDS">
        <div className="px-body" style={{ textAlign: 'center', marginBottom: 10 }}>
          {config
            ? `+${config.referralMintRewardVotes} $CUBE when an invited friend mints their pass`
            : 'Invited friends earn you $CUBE when they mint'}
        </div>
        <button
          type="button"
          className="px-btn"
          disabled={!inviteUrl}
          onClick={() => openShare(inviteUrl, 'Join me in Cube Worlds — forge your pixel pass!')}
        >
          SHARE INVITE LINK
        </button>
      </Card>

      <Card title="STARS TOP-UP">
        <div style={{ display: 'flex', gap: 8 }}>
          {STARS_PACKS.map((stars) => (
            <button
              key={stars}
              type="button"
              className="px-btn-ghost"
              disabled={busy || !config}
              style={{ flex: 1, color: 'var(--cw-gold)', padding: '10px 0' }}
              onClick={() => void onTopup(stars)}
            >
              {`⭐ ${stars}`}
              <div style={{ fontFamily: 'var(--font-body)', fontSize: 16, color: 'var(--cw-text-dim)', marginTop: 4 }}>
                {config ? `${(stars * config.starsTopupVotesPerStar).toLocaleString('en-US')} $CUBE` : '…'}
              </div>
            </button>
          ))}
        </div>
      </Card>

      <Card title="DONATE TON">
        <div className="px-body" style={{ textAlign: 'center', marginBottom: 10 }}>
          TON from your bound wallet turns into $CUBE
        </div>
        {hasWallet
          ? (
              <div style={{ display: 'flex', gap: 8 }}>
                {TON_PACKS.map((pack) => (
                  <button
                    key={pack.nano}
                    type="button"
                    className="px-btn-ghost"
                    style={{ flex: 1, color: 'var(--cw-blue)' }}
                    onClick={() => void onDonate(pack.nano)}
                  >
                    {pack.label}
                  </button>
                ))}
              </div>
            )
          : (
              <button type="button" className="px-btn-ghost" onClick={() => void bindWallet()}>
                CONNECT WALLET
              </button>
            )}
      </Card>
    </div>
  )
}

function Card({ title, children }: { title: string, children: React.ReactNode }) {
  return (
    <div className="px-card" style={{ padding: '12px 12px 14px' }}>
      <div className="px-label" style={{ color: 'var(--cw-gold)', marginBottom: 10 }}>
        {title}
      </div>
      {children}
    </div>
  )
}
