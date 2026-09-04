import type { EngineOutcome, EngineResult, EngineVisit, TraitOf } from './types'

// Prisoner's dilemma in pairs. Traits: a thief whose Deceptiveness beats the
// victim's best of Perception/Skepticism keeps the steal off the public record.

export function pairVisits(
  visits: EngineVisit[],
  rng: () => number,
): { pairs: Array<[EngineVisit, EngineVisit]>, alone: EngineVisit[] } {
  const byUser = new Map(visits.map(v => [v.userId, v]))
  const used = new Set<number>()
  const pairs: Array<[EngineVisit, EngineVisit]> = []
  for (const a of visits) {
    if (used.has(a.userId) || a.partnerId === undefined) continue
    const b = byUser.get(a.partnerId)
    if (!b || used.has(b.userId) || b.partnerId !== a.userId) continue
    used.add(a.userId)
    used.add(b.userId)
    pairs.push([a, b])
  }
  const rest = visits.filter(v => !used.has(v.userId))
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[rest[i], rest[j]] = [rest[j], rest[i]]
  }
  for (let i = 0; i + 1 < rest.length; i += 2) pairs.push([rest[i], rest[i + 1]])
  const alone = rest.length % 2 === 1 ? [rest[rest.length - 1]] : []
  return { pairs, alone }
}

function concealed(thief: number, victim: number, traitOf: TraitOf): boolean {
  const eye = Math.max(traitOf(victim, 'Perception'), traitOf(victim, 'Skepticism'))
  return eye < traitOf(thief, 'Deceptiveness')
}

export function resolveSplitSteal(
  placeName: string,
  visits: EngineVisit[],
  stake: bigint,
  bonus: bigint,
  traitOf: TraitOf,
  rng: () => number,
): EngineResult {
  const { pairs, alone } = pairVisits(visits, rng)
  const outcomes: EngineOutcome[] = []
  for (const [a, b] of pairs) {
    const aSteals = a.move === 'steal'
    const bSteals = b.move === 'steal'
    if (!aSteals && !bSteals) {
      for (const v of [a, b]) {
        outcomes.push({ userId: v.userId, payout: stake + bonus, outcome: `${placeName} · both helped · +${stake + bonus}`, rep: { helped: 1 } })
      }
    } else if (aSteals && bSteals) {
      for (const v of [a, b]) {
        outcomes.push({ userId: v.userId, payout: 0n, outcome: `${placeName} · both stole · burned`, rep: { stole: 1 } })
      }
    } else {
      const thief = aSteals ? a : b
      const victim = aSteals ? b : a
      const hidden = concealed(thief.userId, victim.userId, traitOf)
      outcomes.push({ userId: thief.userId, payout: stake * 2n, outcome: `${placeName} · you stole · +${stake * 2n}`, ...(hidden ? {} : { rep: { stole: 1 } }) })
      outcomes.push({ userId: victim.userId, payout: 0n, outcome: `${placeName} · you were robbed · 0`, rep: { helped: 1 } })
    }
  }
  for (const v of alone) {
    outcomes.push({ userId: v.userId, payout: stake, outcome: `${placeName} · nobody came · refunded ${stake}`, refund: true })
  }
  return { outcomes }
}
