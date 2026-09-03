import type { ClaimStatus, PublicConfig } from '../api'
import { useTonConnectUI } from '@tonconnect/ui-react'
import { useCallback, useEffect, useState } from 'react'
import { claimDaily, claimStatus, topupInvoice } from '../api'
import { useWalletBind } from '../hooks/useWalletBind'
import { haptic, openInvoice, openShare } from '../telegram'

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
  const [claim, setClaim] = useState<ClaimStatus | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [tonConnectUI] = useTonConnectUI()
  const { bindWallet } = useWalletBind(onWalletBound)

  const refreshClaim = useCallback(async () => {
    try {
      const status = await claimStatus()
      if (!status.error) setClaim(status)
    } catch {
      // keep the previous snapshot
    }
  }, [])

  useEffect(() => {
    void refreshClaim()
    const timer = setInterval(() => void refreshClaim(), 30_000)
    return () => clearInterval(timer)
  }, [refreshClaim])

  async function onClaim() {
    if (busy) return
    setBusy(true)
    setNotice(null)
    try {
      const result = await claimDaily()
      if (result.error) {
        setNotice(result.error)
      } else {
        onBalance(result.balance)
        haptic('success')
      }
      await refreshClaim()
    } catch {
      setNotice('Network error — try again')
    } finally {
      setBusy(false)
    }
  }

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
        {claim
          ? (
              claim.canClaim
                ? (
                    <button
                      type="button"
                      className="px-btn"
                      disabled={busy}
                      onClick={() => void onClaim()}
                    >
                      {`CLAIM ${claim.rawClaimAmount} $CUBE`}
                    </button>
                  )
                : (
                    <>
                      <Progress percent={claim.progressPercent} />
                      <div className="px-body" style={{ textAlign: 'center', marginTop: 8 }}>
                        next claim in
                        {' '}
                        {formatSeconds(claim.secondsUntilClaim)}
                      </div>
                    </>
                  )
            )
          : (
              <div className="px-pulse px-label" style={{ textAlign: 'center' }}>…</div>
            )}
        {claim && (
          <div className="px-body" style={{ textAlign: 'center', marginTop: 8 }}>
            streak
            {' '}
            {claim.streakDays}
            {' '}
            day(s) · multiplier ×
            {claim.claimMultiplier}
          </div>
        )}
      </Card>

      <Card title="INVITE FRIENDS">
        <div className="px-body" style={{ textAlign: 'center', marginBottom: 10 }}>
          Every invited explorer earns you $CUBE
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
              disabled={busy}
              style={{ flex: 1, color: 'var(--cw-gold)' }}
              onClick={() => void onTopup(stars)}
            >
              {`⭐ ${stars}`}
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

function Progress({ percent }: { percent: number }) {
  return (
    <div
      style={{
        height: 10,
        background: 'var(--cw-border-dark)',
        border: '2px solid var(--cw-border)',
        position: 'relative',
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: `${Math.min(100, Math.max(0, percent))}%`,
          background: 'var(--cw-gold-dark)',
        }}
      />
    </div>
  )
}

function formatSeconds(total: number): string {
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}
