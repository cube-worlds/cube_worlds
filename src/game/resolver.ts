import type { VisitRecord } from '#root/common/models/Visit'
import type { EngineOutcome, EngineResult, EngineVisit, RepDelta } from '#root/game/engines/types'
import type { PlaceDef } from '#root/game/places'
import type { Traits } from '#root/game/traits'
import { BalanceChangeType } from '#root/common/models/Balance'
import { resolveCommons } from '#root/game/engines/commons'
import { resolveMinority } from '#root/game/engines/minority'
import { resolveSplitSteal } from '#root/game/engines/split-steal'
import { windowIdAt } from '#root/game/places'
import { traitOf, weightOf } from '#root/game/traits'

export interface ResolverDependencies {
  now: () => number
  places: readonly PlaceDef[]
  claimWindow: (windowId: number, nowMs: number) => Promise<boolean>
  markWindowResolved: (windowId: number) => Promise<void>
  findWindowsToResolve: (beforeWindowId: number) => Promise<number[]>
  findUnresolvedVisits: (windowId: number) => Promise<VisitRecord[]>
  resolveVisitOnce: (visitId: string, payout: bigint, outcome: string) => Promise<boolean>
  addPoints: (userId: number, amount: bigint, reason: BalanceChangeType) => Promise<unknown>
  bumpRep: (userId: number, delta: RepDelta) => Promise<void>
  getPool: (place: string, seed: bigint) => Promise<bigint>
  setPool: (place: string, pool: bigint, windowId: number) => Promise<boolean>
  traitsOf: (userIds: number[]) => Promise<Map<number, Traits | undefined>>
  notify: (userId: number, text: string, place: string) => Promise<void>
  rng: () => number
  logError: (message: string) => void
}

function toEngineVisit(v: VisitRecord): EngineVisit {
  return { userId: v.userId, move: v.move, stake: v.stake, partnerId: v.partnerId }
}

export function buildResolver(deps: ResolverDependencies) {
  async function runEngine(place: PlaceDef, visits: VisitRecord[], traits: Map<number, Traits | undefined>): Promise<EngineResult> {
    const weight = (userId: number) => weightOf(traits.get(userId), place.traits)
    const trait = (userId: number, name: string) => traitOf(traits.get(userId), name)
    const engineVisits = visits.map(toEngineVisit)
    switch (place.engine) {
      case 'minority':
        return resolveMinority(place.name, engineVisits, place.pot, weight)
      case 'split-steal':
        return resolveSplitSteal(place.name, engineVisits, place.stake, place.bonus, trait, deps.rng)
      case 'commons': {
        const pool = await deps.getPool(place.id, place.seed)
        return resolveCommons(place.name, engineVisits, place.stake, place.seed, pool, weight)
      }
      default:
        // rest / soon: nothing to play — give the stake back.
        return { outcomes: visits.map(v => ({ userId: v.userId, payout: v.stake, outcome: `${place.name} · closed · refunded ${v.stake}`, refund: true })) }
    }
  }

  async function settle(visit: VisitRecord, outcome: EngineOutcome, place: string) {
    const won = await deps.resolveVisitOnce(visit.id, outcome.payout, outcome.outcome)
    if (!won) return false
    if (outcome.payout > 0n) {
      await deps.addPoints(visit.userId, outcome.payout, outcome.refund ? BalanceChangeType.Stake : BalanceChangeType.Payout)
    }
    if (outcome.rep) await deps.bumpRep(visit.userId, outcome.rep)
    try {
      await deps.notify(visit.userId, outcome.outcome, place)
    } catch (err) {
      deps.logError(`Bali notify failed for ${visit.userId}: ${(err as Error).message}`)
    }
    return true
  }

  async function resolveWindow(windowId: number): Promise<number> {
    if (!(await deps.claimWindow(windowId, deps.now()))) return 0
    const visits = await deps.findUnresolvedVisits(windowId)
    const traits = await deps.traitsOf([...new Set(visits.map(v => v.userId))])
    const byPlace = new Map<string, VisitRecord[]>()
    for (const v of visits) byPlace.set(v.place, [...(byPlace.get(v.place) ?? []), v])

    let paid = 0
    for (const [placeId, placeVisits] of byPlace) {
      const place = deps.places.find(p => p.id === placeId)
        ?? { id: placeId, name: placeId, engine: 'soon' as const, traits: [], stake: 0n, pot: 0n, seed: 0n, bonus: 0n, open: false, lat: 0, lon: 0 }
      const result = await runEngine(place, placeVisits, traits)
      if (result.pool !== undefined) await deps.setPool(place.id, result.pool, windowId)
      const byUser = new Map(placeVisits.map(v => [v.userId, v]))
      const settledIds = new Set<number>()
      for (const outcome of result.outcomes) {
        const visit = byUser.get(outcome.userId)
        if (!visit) continue
        settledIds.add(outcome.userId)
        if (await settle(visit, outcome, place.id)) paid += 1
      }
      // An engine that returned no outcome for a visit would strand its stake
      // once the window closes — refund instead.
      for (const visit of placeVisits) {
        if (settledIds.has(visit.userId)) continue
        const fallback = { userId: visit.userId, payout: visit.stake, outcome: `${place.name} · unresolved · refunded ${visit.stake}`, refund: true }
        if (await settle(visit, fallback, place.id)) paid += 1
      }
    }
    await deps.markWindowResolved(windowId)
    return paid
  }

  async function tick(): Promise<void> {
    const windows = await deps.findWindowsToResolve(windowIdAt(deps.now()))
    for (const windowId of windows) {
      try {
        await resolveWindow(windowId)
      } catch (err) {
        deps.logError(`Bali window ${windowId} failed: ${(err as Error).message}`)
      }
    }
  }

  return { resolveWindow, tick }
}
