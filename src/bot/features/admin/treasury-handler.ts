import type { PlaceDef } from '#root/game/places'

// Bali engines never mint: a window pays out at most what its visitors staked
// plus what the place treasury already held (docs/BALI_SPEC.md §3). So a place
// that has paid out its seed stays poor forever unless an operator budgets more
// in. This command is that budget line — the only faucet into Bali — which is
// why it is admin-only, capped per call, and echoes the resulting pool.
export interface TreasuryHandlerDependencies {
  places: readonly PlaceDef[]
  getPools: () => Promise<Map<string, bigint>>
  addToPool: (place: string, amount: bigint, seed: bigint) => Promise<bigint>
}

// A fat finger here mints $CUBE into the game with no undo, so one command
// cannot move more than this. Larger budgets are several deliberate calls.
export const TOPUP_LIMIT = 1_000_000n

export function buildTreasuryHandler(deps: TreasuryHandlerDependencies) {
  const playable = deps.places.filter(p => p.engine !== 'rest' && p.engine !== 'soon')

  async function report(): Promise<string> {
    const pools = await deps.getPools()
    const rows = playable.map((p) => {
      const pool = pools.get(p.id) ?? p.seed
      const seeded = pools.has(p.id) ? '' : ' (unseeded)'
      return `${p.id.padEnd(10)} ${String(pool).padStart(9)}${seeded}`
    })
    const total = playable.reduce((s, p) => s + (pools.get(p.id) ?? p.seed), 0n)
    return [
      '<b>Bali treasuries</b>',
      `<pre>${rows.join('\n')}\n${'total'.padEnd(10)} ${String(total).padStart(9)}</pre>`,
      'Top up: <code>/treasury &lt;place&gt; &lt;amount&gt;</code> (negative drains, floored at 0)',
    ].join('\n')
  }

  return async function treasury(argument: string): Promise<string> {
    const [placeId, rawAmount, ...rest] = argument.trim().split(/\s+/).filter(Boolean)
    if (!placeId) return report()
    if (rest.length > 0) return 'Usage: <code>/treasury &lt;place&gt; &lt;amount&gt;</code>'

    const place = playable.find(p => p.id === placeId)
    if (!place) return `No playable place "${placeId}". Send <code>/treasury</code> for the list.`
    if (rawAmount === undefined) return 'How much? <code>/treasury &lt;place&gt; &lt;amount&gt;</code>'
    if (!/^-?\d+$/.test(rawAmount)) return `"${rawAmount}" is not a whole number of $CUBE.`

    const amount = BigInt(rawAmount)
    if (amount === 0n) return 'Nothing to do.'
    if (amount > TOPUP_LIMIT || amount < -TOPUP_LIMIT) {
      return `One call moves at most ${TOPUP_LIMIT} $CUBE. Split it up.`
    }

    const pool = await deps.addToPool(place.id, amount, place.seed)
    const verb = amount > 0n ? 'Topped up' : 'Drained'
    return `${verb} <b>${place.name}</b> by ${amount > 0n ? '+' : ''}${amount}. Pool is now <b>${pool}</b>.`
  }
}
