import type { EngineOutcome, EngineResult, EngineVisit, TraitOf } from './types'
import { pairVisits } from './helpers'

// Prisoner's dilemma in pairs. Traits: a thief whose Deceptiveness beats the
// victim's best of Perception/Skepticism keeps the steal off the public record.

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
      for (const [v, p] of [[a, b], [b, a]] as const) {
        outcomes.push({ userId: v.userId, partnerId: p.userId, payout: stake + bonus, outcome: `${placeName} · both helped · +${stake + bonus}`, rep: { helped: 1 } })
      }
    } else if (aSteals && bSteals) {
      for (const [v, p] of [[a, b], [b, a]] as const) {
        outcomes.push({ userId: v.userId, partnerId: p.userId, payout: 0n, outcome: `${placeName} · both stole · burned`, rep: { stole: 1 } })
      }
    } else {
      const thief = aSteals ? a : b
      const victim = aSteals ? b : a
      const hidden = concealed(thief.userId, victim.userId, traitOf)
      outcomes.push({ userId: thief.userId, partnerId: victim.userId, payout: stake * 2n, outcome: `${placeName} · you stole · +${stake * 2n}`, ...(hidden ? {} : { rep: { stole: 1 } }) })
      outcomes.push({ userId: victim.userId, partnerId: thief.userId, payout: 0n, outcome: `${placeName} · you were robbed · 0`, rep: { helped: 1 } })
    }
  }
  for (const v of alone) {
    outcomes.push({ userId: v.userId, payout: stake, outcome: `${placeName} · nobody came · refunded ${stake}`, refund: true })
  }
  return { outcomes }
}
