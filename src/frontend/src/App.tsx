import type { LoginResponse, PublicConfig } from './api'
import { useCallback, useEffect, useState } from 'react'
import { login, publicConfig } from './api'
import { EarnPanel } from './components/EarnPanel'
import { MintFlow } from './components/MintFlow'
import { PassView } from './components/PassView'
import { TitleScreen } from './components/TitleScreen'
import { expand, getStartParam, haptic } from './telegram'

type Tab = 'forge' | 'earn'

export function App() {
  const [entered, setEntered] = useState(false)
  const [tab, setTab] = useState<Tab>('forge')
  const [user, setUser] = useState<LoginResponse | null>(null)
  const [config, setConfig] = useState<PublicConfig | null>(null)
  const [balance, setBalance] = useState('0')
  const [minted, setMinted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    expand()
    void publicConfig().then(setConfig).catch(() => {})
    void login(getStartParam())
      .then((result) => {
        if (result.error) {
          setError(result.error)
          return
        }
        setUser(result)
        setBalance(result.balance)
        setMinted(result.minted)
      })
      .catch(() => setError('Cannot reach the realm — open the app from Telegram'))
  }, [])

  const refreshLogin = useCallback(() => {
    void login()
      .then((result) => {
        if (result.error) return
        setUser(result)
        setBalance(result.balance)
        setMinted(result.minted)
      })
      .catch(() => {})
  }, [])

  if (!entered) {
    return (
      <TitleScreen
        onEnter={() => {
          haptic('light')
          setEntered(true)
        }}
      />
    )
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: 'linear-gradient(180deg, #0d0a12 0%, #171020 100%)',
      }}
    >
      <header
        style={{
          flex: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 14px',
          background: 'var(--cw-bg)',
          borderBottom: '1px solid var(--cw-border-dark)',
        }}
      >
        <div className="px-label" style={{ color: '#8f7f4a' }}>CUBE WORLDS</div>
        <div className="px-label" style={{ color: 'var(--cw-gold)' }}>
          {Number(balance).toLocaleString('en-US')}
          {' '}
          $CUBE
        </div>
      </header>

      <main style={{ flex: 1, overflowY: 'auto', paddingBottom: 70 }}>
        {error && (
          <div className="px-body" style={{ textAlign: 'center', padding: 40, color: 'var(--cw-red-bright)' }}>
            {error}
          </div>
        )}
        {!error && !user && (
          <div className="px-pulse px-label" style={{ textAlign: 'center', paddingTop: 120 }}>
            ENTERING THE REALM…
          </div>
        )}
        {user && minted && <PassView />}
        {user && !minted && tab === 'forge' && (
          <MintFlow onBalance={setBalance} onMinted={() => setMinted(true)} />
        )}
        {user && !minted && tab === 'earn' && (
          <EarnPanel
            balance={balance}
            userId={user.id}
            hasWallet={Boolean(user.wallet)}
            config={config}
            onBalance={setBalance}
            onWalletBound={refreshLogin}
          />
        )}
      </main>

      {user && !minted && (
        <nav
          style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            display: 'flex',
            background: 'var(--cw-bg)',
            borderTop: '2px solid var(--cw-border-dark)',
          }}
        >
          <TabButton label="⚒ FORGE" active={tab === 'forge'} onClick={() => setTab('forge')} />
          <TabButton label="⛏ EARN" active={tab === 'earn'} onClick={() => setTab('earn')} />
        </nav>
      )}
    </div>
  )
}

function TabButton({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
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
        borderRadius: 0,
      }}
    >
      {label}
    </button>
  )
}
