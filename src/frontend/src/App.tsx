import type { LoginResponse, PublicConfig } from './api'
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { login, publicConfig } from './api'
import { BaliTab } from './components/BaliTab'
import { Fork } from './components/Fork'
import { HeroTab } from './components/HeroTab'
import { Hub } from './components/Hub'
import { MintFlow } from './components/MintFlow'
import { PassScan } from './components/PassScan'
import { TitleScreen } from './components/TitleScreen'
import { expand, getStartParam, haptic } from './telegram'

// ~400 kB of TON Connect — two thirds of the bundle — and nothing on the boot
// path needs it. These three are the only modules that reach it, so they share
// one async chunk that loads when a wallet screen is first opened.
const TonConnectGate = lazy(() => import('./components/TonConnectGate'))
const WalletScreen = lazy(() => import('./components/WalletScreen').then((m) => ({ default: m.WalletScreen })))
const EarnPanel = lazy(() => import('./components/EarnPanel').then((m) => ({ default: m.EarnPanel })))

// title → holder ? hub : fork
// fork → forge | wallet(pass)
// forge → wallet(forge) → forge ; forge(minted) → scan
// wallet(pass) → scan → hub
// hub: tabs hub · bali · hero · earn ; hero → SWITCH PASS → scan
// startapp bali_<place> → bali tab ; meet_<code> → bali tab with an invite
type Screen =
  | { name: 'title' }
  | { name: 'fork' }
  | { name: 'forge' }
  | { name: 'earn' } // pre-hub EARN reached from the forge
  | { name: 'wallet', reason: 'forge' | 'pass' }
  | { name: 'scan' }
  | { name: 'hub', tab: 'hub' | 'bali' | 'hero' | 'earn' }

type Phase = 'loading' | 'ready' | 'error'

export function App() {
  const [screen, setScreen] = useState<Screen>({ name: 'title' })
  const [phase, setPhase] = useState<Phase>('loading')
  const [user, setUser] = useState<LoginResponse | null>(null)
  const [config, setConfig] = useState<PublicConfig | null>(null)
  const [balance, setBalance] = useState('0')
  const [error, setError] = useState<string | undefined>()
  const [tonMounted, setTonMounted] = useState(false)
  const [{ bali, meet, referId }] = useState(() => {
    const start = getStartParam()
    const bali = start?.startsWith('bali_') ? start.slice(5) : null
    const meet = start?.startsWith('meet_') ? start.slice(5) : null
    return { bali, meet, referId: bali || meet ? undefined : start }
  })

  const boot = useCallback(() => {
    setPhase('loading')
    setError(undefined)
    void Promise.all([publicConfig(), login(referId)])
      .then(([cfg, result]) => {
        if (result.error) {
          setError(result.error)
          setPhase('error')
          return
        }
        setConfig(cfg)
        setUser(result)
        setBalance(result.balance)
        setPhase('ready')
        // Warm the TON Connect chunk now that the boot requests are done, so
        // pressing CONNECT later doesn't wait on a cold fetch.
        void import('./components/TonConnectGate')
      })
      .catch(() => {
        setError('Cannot reach the realm — open the app from Telegram')
        setPhase('error')
      })
  }, [referId])

  useEffect(() => {
    expand()
    boot()
  }, [boot])

  // The only screens that call into TON Connect. WalletScreen also stands in
  // for `scan` when no wallet is bound yet, hence the second clause.
  const needsTon
    = screen.name === 'wallet'
      || screen.name === 'earn'
      || (screen.name === 'scan' && !user?.wallet)
      || (screen.name === 'hub' && screen.tab === 'earn')

  // Sticky: once the provider is up it stays up. Unmounting it would destroy
  // the TonConnectUI instance and the wallet connection along with it.
  useEffect(() => {
    if (needsTon) setTonMounted(true)
  }, [needsTon])

  // Re-login (username gate REFRESH, wallet bound). Keeps the current screen.
  const refreshLogin = useCallback(() => {
    void login()
      .then((result) => {
        if (result.error) return
        setUser(result)
        setBalance(result.balance)
      })
      .catch(() => {})
  }, [])

  if (screen.name === 'title' || !user) {
    return (
      <TitleScreen
        phase={phase}
        error={error}
        onRetry={boot}
        onEnter={() => {
          if (!user) return
          haptic('light')
          setScreen(user.holder ? { name: 'hub', tab: bali || meet ? 'bali' : 'hub' } : { name: 'fork' })
        }}
      />
    )
  }

  const goForge = () => setScreen({ name: 'forge' })
  const goScan = () => setScreen({ name: 'scan' })
  const goHub = (tab: 'hub' | 'bali' | 'hero' | 'earn' = 'hub') => setScreen({ name: 'hub', tab })

  let body: React.ReactNode
  switch (screen.name) {
    case 'fork':
      body = (
        <Fork
          username={user.username}
          tryCost={config?.generationTryCostVotes ?? null}
          onForge={goForge}
          onHavePass={() => setScreen({ name: 'wallet', reason: 'pass' })}
        />
      )
      break
    case 'forge':
      body = (
        <MintFlow
          username={user.username}
          onBalance={setBalance}
          onRefreshLogin={refreshLogin}
          onNeedWallet={() => setScreen({ name: 'wallet', reason: 'forge' })}
          onEnterWorld={goScan}
          onEarn={() => setScreen({ name: 'earn' })}
          onBack={() => setScreen({ name: 'fork' })}
        />
      )
      break
    case 'earn':
      body = (
        <div>
          <div style={{ padding: '14px 16px 0' }}>
            <button type="button" className="px-back" onClick={goForge}>‹ FORGE</button>
          </div>
          <EarnPanel
            balance={balance}
            userId={user.id}
            hasWallet={Boolean(user.wallet)}
            config={config}
            onBalance={setBalance}
            onWalletBound={refreshLogin}
          />
        </div>
      )
      break
    case 'wallet':
      body = (
        <WalletScreen
          reason={screen.reason}
          wallet={user.wallet}
          onBound={(address) => setUser({ ...user, wallet: address })}
          onContinue={screen.reason === 'forge' ? goForge : goScan}
          onBack={() => setScreen(screen.reason === 'forge' ? { name: 'forge' } : { name: 'fork' })}
        />
      )
      break
    case 'scan':
      body = user.wallet
        ? (
            <PassScan
              wallet={user.wallet}
              minted={user.minted}
              onSelected={(next) => {
                setUser(next)
                setBalance(next.balance)
                goHub()
              }}
              onForge={goForge}
              onSwitchWallet={() => setScreen({ name: 'wallet', reason: 'pass' })}
              onBack={() => setScreen(user.holder ? { name: 'hub', tab: 'hero' } : { name: 'wallet', reason: 'pass' })}
            />
          )
        : (
            <WalletScreen
              reason="pass"
              onBound={(address) => setUser({ ...user, wallet: address })}
              onContinue={goScan}
              onBack={() => setScreen({ name: 'fork' })}
            />
          )
      break
    case 'hub':
      if (!user.pass) {
        // Pass cleared by revalidation (sold) — back to the fork.
        body = (
          <Fork
            username={user.username}
            tryCost={config?.generationTryCostVotes ?? null}
            onForge={goForge}
            onHavePass={() => setScreen({ name: 'wallet', reason: 'pass' })}
          />
        )
        break
      }
      if (screen.tab === 'hub') {
        body = <Hub pass={user.pass} username={user.username} onBalance={setBalance} onBali={() => goHub('bali')} onHero={() => goHub('hero')} onEarn={() => goHub('earn')} />
      } else if (screen.tab === 'bali') {
        body = <BaliTab botName={config?.botName ?? ''} startPlace={bali} inviteCode={meet} onBalance={setBalance} />
      } else if (screen.tab === 'hero') {
        body = <HeroTab pass={user.pass} wallet={user.wallet} collectionAddress={config?.collectionAddress} onSwitchPass={goScan} />
      } else {
        body = (
          <EarnPanel
            balance={balance}
            userId={user.id}
            hasWallet={Boolean(user.wallet)}
            config={config}
            onBalance={setBalance}
            onWalletBound={refreshLogin}
          />
        )
      }
      break
  }

  const inHub = screen.name === 'hub' && Boolean(user.pass)

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'linear-gradient(180deg, #0d0a12 0%, #171020 100%)' }}>
      <header style={{ flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--cw-bg)', borderBottom: '1px solid var(--cw-border-dark)' }}>
        <div className="px-label" style={{ color: '#8f7f4a' }}>CUBE WORLDS</div>
        <Balance value={balance} />
      </header>

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', paddingBottom: inHub ? 70 : 0 }}>
        {needsTon || tonMounted
          ? (
              <Suspense fallback={<div className="px-label" style={{ padding: 24, color: 'var(--cw-text-dim)' }}>LOADING WALLET…</div>}>
                <TonConnectGate>{body}</TonConnectGate>
              </Suspense>
            )
          : body}
      </main>

      {inHub && (
        <nav style={{ position: 'fixed', bottom: 0, left: 0, right: 0, display: 'flex', background: 'var(--cw-bg)', borderTop: '2px solid var(--cw-border-dark)' }}>
          <TabButton label="⌂ HUB" active={screen.tab === 'hub'} onClick={() => goHub('hub')} />
          <TabButton label="🌴 BALI" active={screen.tab === 'bali'} onClick={() => goHub('bali')} />
          <TabButton label="▣ HERO" active={screen.tab === 'hero'} onClick={() => goHub('hero')} />
          <TabButton label="◆ EARN" active={screen.tab === 'earn'} onClick={() => goHub('earn')} />
        </nav>
      )}
    </div>
  )
}

// Balance with a floating +N / −N tick on change (cwTick keyframe).
function Balance({ value }: { value: string }) {
  const previous = useRef(value)
  const [tick, setTick] = useState<{ delta: number, key: number } | null>(null)

  useEffect(() => {
    const delta = Number(value) - Number(previous.current)
    previous.current = value
    if (delta !== 0) setTick({ delta, key: Date.now() })
  }, [value])

  return (
    <div className="px-label" style={{ position: 'relative', color: 'var(--cw-gold)' }}>
      {Number(value).toLocaleString('en-US')}
      {' '}
      $CUBE
      {tick && (
        <span
          key={tick.key}
          onAnimationEnd={() => setTick(null)}
          style={{ position: 'absolute', right: 0, top: -14, color: tick.delta > 0 ? 'var(--cw-green)' : 'var(--cw-red-bright)', animation: 'cwTick 1.2s steps(6) forwards' }}
        >
          {tick.delta > 0 ? `+${tick.delta}` : `−${Math.abs(tick.delta)}`}
        </span>
      )}
    </div>
  )
}

function TabButton({ label, active, onClick }: { label: string, active: boolean, onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: 1,
        padding: '14px 0 16px',
        cursor: 'pointer',
        fontFamily: 'var(--font-pixel)',
        fontSize: 9,
        letterSpacing: 1,
        color: active ? '#1a1206' : 'var(--cw-text-dim)',
        background: active ? 'var(--cw-gold-dark)' : 'transparent',
        border: 'none',
        borderTop: active ? '3px solid var(--cw-gold)' : '3px solid transparent',
        borderRadius: 0,
      }}
    >
      {label}
    </button>
  )
}
