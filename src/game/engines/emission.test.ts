/* eslint-disable test/no-import-node-test */
import type { EngineResult, EngineVisit } from '#root/game/engines/types'
import type { Move, PlaceDef } from '#root/game/places'
import assert from 'node:assert'
import { describe, it } from 'node:test'
import { resolveAllPay } from '#root/game/engines/all-pay'
import { resolveCommons } from '#root/game/engines/commons'
import { resolveHawkDove } from '#root/game/engines/hawk-dove'
import { resolveHeist } from '#root/game/engines/heist'
import { grantFor, staked } from '#root/game/engines/helpers'
import { resolveMinority } from '#root/game/engines/minority'
import { resolveSplitSteal } from '#root/game/engines/split-steal'
import { resolveStagHunt } from '#root/game/engines/stag-hunt'
import { resolveUltimatum } from '#root/game/engines/ultimatum'
import { resolveVolunteer } from '#root/game/engines/volunteer'
import { movesFor, PLACES, POT_TURNOUT_MULT, stakeFor } from '#root/game/places'

// The one rule the whole treasury design exists to enforce: a window can pay
// out at most what its visitors staked plus what the place treasury already
// held, and the treasury it hands back is never negative. Nothing is minted,
// at any turnout, under any move profile.
//
// The shipped slice-2 numbers failed this at every turnout below ~13 visitors
// per place per window (see docs/BALI_SPEC.md §1) — a fixed pot was paid out
// whole however few people came, and the passive move at Amed, Gili and Nusa
// Penida minted a fresh bonus per head with no break-even at all.

let seed = 1
const rng = () => ((seed = (seed * 1103515245 + 12345) & 0x7FFFFFFF) / 0x7FFFFFFF)
const weightOf = (userId: number) => 1 + (userId % 9)
const traitOf = (userId: number) => 1 + (userId % 10)

function run(place: PlaceDef, visits: EngineVisit[], pool: bigint): EngineResult {
  const grant = grantFor(place.pot, visits, pool, POT_TURNOUT_MULT)
  switch (place.engine) {
    case 'minority': return resolveMinority(place.name, visits, grant, pool, weightOf)
    case 'split-steal': return resolveSplitSteal(place.name, visits, place.stake, place.bonus, grant, pool, traitOf, rng)
    case 'commons': return resolveCommons(place.name, visits, place.stake, place.seed, pool, weightOf)
    case 'hawk-dove': return resolveHawkDove(place.name, visits, place.stake, grant, pool, weightOf, rng)
    case 'heist': return resolveHeist(place.name, visits, grant, pool, weightOf, traitOf)
    case 'all-pay': return resolveAllPay(place.name, visits, place.pot, pool, weightOf, rng)
    case 'volunteer': return resolveVolunteer(place.name, visits, place.stake, grant, pool, weightOf, rng)
    case 'stag-hunt': return resolveStagHunt(place.name, visits, place.stake, grant, pool, weightOf)
    case 'ultimatum': return resolveUltimatum(place.name, visits, place.stake, place.bonus, grant, pool, weightOf, rng)
    default: throw new Error(`no engine for ${place.engine}`)
  }
}

function visitsFor(place: PlaceDef, n: number, pick: (i: number, moves: readonly Move[]) => Move | null): EngineVisit[] {
  return Array.from({ length: n }, (_, i) => {
    const moves = movesFor(place.engine)
    const move = moves.length === 0 ? null : pick(i, moves)
    return { userId: i, move, stake: stakeFor(place, move) }
  })
}

// Every profile a room could actually settle on, not just a random mix: an
// all-cooperate community is exactly the case the shipped design could not
// survive (+2,000/window at Canggu and Gili at 40 visitors).
function profiles(place: PlaceDef): Array<(i: number, moves: readonly Move[]) => Move | null> {
  const moves = movesFor(place.engine)
  return [
    ...moves.map(m => () => m),
    (_i, ms) => ms[Math.floor(rng() * ms.length)],
    (i, ms) => ms[i % ms.length],
  ]
}

const playable = PLACES.filter(p => p.engine !== 'rest' && p.engine !== 'soon')

describe('bali emission', () => {
  for (const place of playable) {
    it(`${place.name} never pays out more than it took in`, () => {
      for (const pick of profiles(place)) {
        for (const n of [0, 1, 2, 3, 4, 5, 7, 11, 20, 41, 60]) {
          for (const pool of [0n, 1n, 500n, 5000n, 50_000n]) {
            const visits = visitsFor(place, n, pick)
            const result = run(place, visits, pool)
            const paid = result.outcomes.reduce((s, o) => s + o.payout, 0n)
            const budget = staked(visits) + pool
            const where = `${place.name} n=${n} pool=${pool}`

            assert.ok(paid <= budget, `${where}: paid ${paid} > staked+pool ${budget}`)
            assert.ok(result.pool !== undefined, `${where}: engine returned no treasury`)
            assert.ok(result.pool! >= 0n, `${where}: treasury went negative (${result.pool})`)
            // Conservation: every coin is either paid out or left in the pool.
            assert.ok(paid + result.pool! <= budget, `${where}: ${paid} + ${result.pool} > ${budget}`)
          }
        }
      }
    })
  }

  it('a place cannot be drained by repeated windows', () => {
    // 200 windows of the most expensive profile at each place: the treasury
    // must survive without ever going negative, and payouts must degrade
    // rather than the pool going into debt.
    for (const place of playable) {
      let pool = place.seed
      for (let w = 0; w < 200; w++) {
        const visits = visitsFor(place, 6, (_i, ms) => ms[0])
        const result = run(place, visits, pool)
        const paid = result.outcomes.reduce((s, o) => s + o.payout, 0n)
        assert.ok(paid <= staked(visits) + pool, `${place.name} window ${w} overpaid`)
        pool = result.pool!
        assert.ok(pool >= 0n, `${place.name} window ${w}: treasury ${pool}`)
      }
    }
  })

  it('refunds are never scaled down by a broke treasury', () => {
    // A lone visitor to a pair game gets their stake back whole even when the
    // place has nothing — a refund is a stake return, not a prize.
    for (const place of playable.filter(p => ['split-steal', 'hawk-dove', 'ultimatum', 'heist', 'all-pay'].includes(p.engine))) {
      const visits = visitsFor(place, 1, (_i, ms) => ms[0])
      const result = run(place, visits, 0n)
      const refunds = result.outcomes.filter(o => o.refund)
      assert.equal(refunds.length, 1, `${place.name} did not refund its lone visitor`)
      assert.equal(refunds[0].payout, visits[0].stake, `${place.name} shaved a refund`)
    }
  })
})
