/* eslint-disable test/no-import-node-test */
import type { EngineVisit } from '#root/game/engines/types'
import assert from 'node:assert/strict'
import test from 'node:test'
import { pairVisits, resolveSplitSteal } from '#root/game/engines/split-steal'

const traits: Record<number, Record<string, number>> = {
  1: { Deceptiveness: 8, Perception: 3, Skepticism: 3 },
  2: { Deceptiveness: 2, Perception: 7, Skepticism: 3 },
  3: { Deceptiveness: 7, Perception: 5, Skepticism: 5 },
  4: { Deceptiveness: 1, Perception: 1, Skepticism: 1 },
}
const traitOf = (id: number, name: string) => traits[id]?.[name] ?? 5
const v = (userId: number, move: 'help' | 'steal', partnerId?: number): EngineVisit =>
  ({ userId, move, stake: 200n, partnerId })
const noShuffle = () => 0
const byUser = (r: ReturnType<typeof resolveSplitSteal>) =>
  Object.fromEntries(r.outcomes.map(o => [o.userId, o]))

test('help/help pays stake + bonus and records helped', () => {
  const out = byUser(resolveSplitSteal('Canggu', [v(1, 'help'), v(2, 'help')], 200n, 50n, traitOf, noShuffle))
  assert.equal(out[1].payout, 250n)
  assert.equal(out[2].payout, 250n)
  assert.deepEqual(out[1].rep, { helped: 1 })
  assert.equal(out[1].outcome, 'Canggu · both helped · +250')
})

test('steal/help: thief takes both stakes, victim gets 0', () => {
  const out = byUser(resolveSplitSteal('Canggu', [v(2, 'steal'), v(1, 'help')], 200n, 50n, traitOf, noShuffle))
  assert.equal(out[2].payout, 400n)
  assert.equal(out[1].payout, 0n)
  assert.equal(out[1].outcome, 'Canggu · you were robbed · 0')
  assert.equal(out[2].outcome, 'Canggu · you stole · +400')
  // thief 2 has Deceptiveness 2, victim 1 sees with max(3,3)=3 ≥ 2 → recorded
  assert.deepEqual(out[2].rep, { stole: 1 })
  assert.deepEqual(out[1].rep, { helped: 1 })
})

test("steal is concealed when Deceptiveness beats the victim's eye", () => {
  // thief 1 (D=8) vs victim 2 (max(P=7,S=3)=7 < 8) → concealed
  const out = byUser(resolveSplitSteal('Canggu', [v(1, 'steal'), v(2, 'help')], 200n, 50n, traitOf, noShuffle))
  assert.equal(out[1].payout, 400n)
  assert.equal(out[1].rep, undefined)
})

test('concealment boundary: equal eye records the steal', () => {
  // thief 3 (D=7) vs victim 3-clone with max(P,S)=7 → 7 ≥ 7 → recorded
  const victimEye: Record<string, number> = { Perception: 7, Skepticism: 1 }
  const eye = (id: number, name: string) => (id === 9 ? victimEye[name] ?? 5 : traitOf(id, name))
  const out = byUser(resolveSplitSteal('Canggu', [v(3, 'steal'), v(9, 'help')], 200n, 50n, eye, noShuffle))
  assert.deepEqual(out[3].rep, { stole: 1 })
})

test('steal/steal burns both stakes and records both', () => {
  const out = byUser(resolveSplitSteal('Canggu', [v(1, 'steal'), v(2, 'steal')], 200n, 50n, traitOf, noShuffle))
  assert.equal(out[1].payout, 0n)
  assert.equal(out[2].payout, 0n)
  assert.deepEqual(out[1].rep, { stole: 1 })
  assert.equal(out[1].outcome, 'Canggu · both stole · burned')
})

test('odd one out is refunded', () => {
  const out = byUser(resolveSplitSteal('Canggu', [v(1, 'help'), v(2, 'help'), v(4, 'steal')], 200n, 50n, traitOf, noShuffle))
  const refunded = Object.values(out).find(o => o.outcome === 'Canggu · nobody came · refunded 200')
  assert.ok(refunded)
  assert.equal(refunded.payout, 200n)
  assert.equal(refunded.rep, undefined)
})

test('invited pair is fixed before random pairing', () => {
  const visits = [v(1, 'help'), v(2, 'help', 4), v(3, 'help'), v(4, 'steal', 2)]
  const { pairs, alone } = pairVisits(visits, () => 0.99)
  assert.equal(alone.length, 0)
  const invited = pairs.find(([a, b]) => a.userId === 2 || b.userId === 2)
  assert.ok(invited)
  assert.deepEqual(new Set([invited[0].userId, invited[1].userId]), new Set([2, 4]))
})

test('a half-bound invite (partner never came) falls back to random pairing', () => {
  const { pairs, alone } = pairVisits([v(1, 'help', 99), v(2, 'help')], noShuffle)
  assert.equal(pairs.length, 1)
  assert.equal(alone.length, 0)
})
