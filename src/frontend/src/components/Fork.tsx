interface ForkProps {
  username: string | null
  tryCost: number | null
  onForge: () => void
  onHavePass: () => void
}

// The onboarding fork: forge a new pass or enter with one already held.
export function Fork({ username, tryCost, onForge, onHavePass }: ForkProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '24px 20px' }}>
      <div className="px-step">{username ? `WELCOME, @${username.toUpperCase()}` : 'WELCOME, STRANGER'}</div>
      <div className="px-title" style={{ fontSize: 14, lineHeight: 1.6 }}>A PASS IS YOUR TICKET IN</div>
      <div className="px-body" style={{ color: 'var(--cw-text)', fontSize: 19 }}>
        World I opens only to holders of a Cube Worlds pass. Forge one from your avatar, or bring one you already own.
      </div>

      <ForkCard
        title="FORGE A NEW PASS"
        body={`Pixel-art from your avatar. ${tryCost ?? '…'} $CUBE per try. Minted after review.`}
        accent="var(--cw-gold)"
        onClick={onForge}
      />
      <ForkCard
        title="I HAVE A PASS"
        body="Connect a TON wallet holding a Cube Worlds NFT."
        accent="var(--cw-blue)"
        onClick={onHavePass}
      />

      <a
        href="https://getgems.io/cubeworlds"
        target="_blank"
        rel="noreferrer"
        className="px-label"
        style={{ textAlign: 'center', marginTop: 8 }}
      >
        BUY ON GETGEMS ›
      </a>
    </div>
  )
}

function ForkCard({
  title,
  body,
  accent,
  onClick,
}: {
  title: string
  body: string
  accent: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-card"
      style={{
        textAlign: 'left',
        padding: 14,
        cursor: 'pointer',
        color: 'inherit',
        borderColor: accent,
        boxShadow: '0 4px 0 var(--cw-border-dark)',
      }}
    >
      <div className="px-title" style={{ fontSize: 10, color: accent }}>{title}</div>
      <div className="px-body" style={{ marginTop: 8 }}>{body}</div>
    </button>
  )
}
