/* eslint-disable test/no-import-node-test */
import type { PlaceDef } from '#root/game/places'
import assert from 'node:assert/strict'
import test from 'node:test'
import { buildTreasuryHandler, TOPUP_LIMIT } from '#root/bot/features/admin/treasury-handler'

const def = (id: string, engine: PlaceDef['engine'], seed: bigint): PlaceDef => ({
  id,
  name: id.toUpperCase(),
  engine,
  traits: [],
  stake: 100n,
  pot: 0n,
  seed,
  bonus: 0n,
  open: true,
  lat: 0,
  lon: 0,
})

const PLACES = [def('ubud', 'minority', 5000n), def('besakih', 'commons', 5000n), def('sanur', 'rest', 0n)]

function harness(pools: Array<[string, bigint]> = [['ubud', 1200n]]) {
  const calls: Array<[string, bigint, bigint]> = []
  const map = new Map(pools)
  const handler = buildTreasuryHandler({
    places: PLACES,
    getPools: async () => map,
    addToPool: async (place, amount, seed) => {
      calls.push([place, amount, seed])
      const next = (map.get(place) ?? seed) + amount
      const clamped = next < 0n ? 0n : next
      map.set(place, clamped)
      return clamped
    },
  })
  return { handler, calls }
}

test('bare /treasury lists every playable place and totals them', async () => {
  const { handler, calls } = harness()
  const text = await handler('')
  assert.match(text, /ubud\s+1200/)
  // No document yet: falls back to the seed and says so, so an operator does
  // not top up a place that has simply never been played.
  assert.match(text, /besakih\s+5000 \(unseeded\)/)
  assert.match(text, /total\s+6200/)
  // rest places have no treasury
  assert.doesNotMatch(text, /sanur/)
  assert.deepEqual(calls, [])
})

test('a top-up adds to the pool and echoes the result', async () => {
  const { handler, calls } = harness()
  assert.match(await handler('ubud 800'), /Topped up.*UBUD.*\+800.*now.*2000/)
  assert.deepEqual(calls, [['ubud', 800n, 5000n]])
})

test('a negative amount drains and is floored at zero', async () => {
  const { handler } = harness()
  assert.match(await handler('ubud -5000'), /Drained.*UBUD.*-5000.*now.*<b>0<\/b>/)
})

test('an unseeded place tops up from its seed', async () => {
  const { handler } = harness([])
  assert.match(await handler('besakih 1000'), /now.*6000/)
})

test('the per-call cap stops a fat finger minting into Bali', async () => {
  const { handler, calls } = harness()
  assert.match(await handler(`ubud ${TOPUP_LIMIT + 1n}`), /at most 1000000/)
  assert.match(await handler(`ubud -${TOPUP_LIMIT + 1n}`), /at most 1000000/)
  assert.deepEqual(calls, [])
})

test('bad input never reaches the database', async () => {
  const { handler, calls } = harness()
  assert.match(await handler('nowhere 100'), /No playable place "nowhere"/)
  assert.match(await handler('sanur 100'), /No playable place "sanur"/)
  assert.match(await handler('ubud'), /How much\?/)
  assert.match(await handler('ubud 1.5'), /not a whole number/)
  assert.match(await handler('ubud 100 200'), /Usage/)
  assert.match(await handler('ubud 0'), /Nothing to do/)
  assert.deepEqual(calls, [])
})
