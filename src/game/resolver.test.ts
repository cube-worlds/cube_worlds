/* eslint-disable test/no-import-node-test */
import type { VisitRecord } from '#root/common/models/Visit'
import type { ResolverDependencies } from '#root/game/resolver'
import assert from 'node:assert/strict'
import test from 'node:test'
import { BalanceChangeType } from '#root/common/models/Balance'
import { PLACES, WINDOW_MS } from '#root/game/places'
import { buildResolver } from '#root/game/resolver'

const W = 100
let seq = 0
function visit(userId: number, place: string, move: VisitRecord['move'] = null, extra: Partial<VisitRecord> = {}): VisitRecord {
  seq += 1
  return { id: `v${seq}`, userId, windowId: W, place, move, stake: 100n, resolved: false, ...extra }
}

interface Harness { deps: ResolverDependencies, paid: Array<[number, bigint, BalanceChangeType]>, notified: Array<[number, string, string]>, reps: Array<[number, object]>, pools: Record<string, bigint>, windows: Array<[string, number]>, errors: string[] }

function harness(visits: VisitRecord[], overrides: Partial<ResolverDependencies> = {}): Harness {
  const store = new Map(visits.map(v => [v.id, { ...v }]))
  const h: Harness = { paid: [], notified: [], reps: [], pools: { besakih: 5000n }, windows: [], errors: [], deps: null as unknown as ResolverDependencies }
  h.deps = {
    now: () => (W + 1) * WINDOW_MS + 1,
    places: PLACES,
    claimWindow: async (id) => { h.windows.push(['claim', id]); return true },
    markWindowResolved: async (id) => { h.windows.push(['resolved', id]) },
    findWindowsToResolve: async () => [...new Set([...store.values()].filter(v => !v.resolved).map(v => v.windowId))].sort((a, b) => a - b),
    findUnresolvedVisits: async (id) => [...store.values()].filter(v => v.windowId === id && !v.resolved),
    resolveVisitOnce: async (id, payout, outcome) => {
      const v = store.get(id)
      if (!v || v.resolved) return false
      Object.assign(v, { resolved: true, payout, outcome })
      return true
    },
    addPoints: async (u, a, r) => { h.paid.push([u, a, r]) },
    bumpRep: async (u, d) => { h.reps.push([u, d]) },
    getPool: async (place, seed) => h.pools[place] ?? seed,
    setPool: async (place, pool) => { h.pools[place] = pool },
    traitsOf: async ids => new Map(ids.map(id => [id, { Deceptiveness: id === 1 ? 10 : 1 }])),
    notify: async (u, text, place) => { h.notified.push([u, text, place]) },
    rng: () => 0,
    logError: m => h.errors.push(m),
    ...overrides,
  }
  return h
}

test('resolves a window: pays each visit once, bumps rep, notifies, closes the window', async () => {
  const h = harness([visit(1, 'ubud'), visit(2, 'ubud'), visit(3, 'canggu', 'steal'), visit(4, 'canggu', 'help')])
  const { resolveWindow } = buildResolver(h.deps)
  assert.equal(await resolveWindow(W), 4)
  assert.deepEqual(h.paid.filter(p => p[1] > 0n).map(p => [p[0], p[1], p[2]]), [
    [1, 750n, BalanceChangeType.Payout],
    [2, 750n, BalanceChangeType.Payout],
    [3, 400n, BalanceChangeType.Payout],
  ])
  assert.deepEqual(h.reps, [[3, { stole: 1 }], [4, { helped: 1 }]])
  assert.equal(h.notified.length, 4)
  assert.deepEqual(h.windows, [['claim', W], ['resolved', W]])
})

test('zero payouts do not touch the ledger', async () => {
  const h = harness([visit(3, 'canggu', 'steal'), visit(4, 'canggu', 'steal')])
  await buildResolver(h.deps).resolveWindow(W)
  assert.deepEqual(h.paid, [])
})

test('commons pool is read with the seed and written back', async () => {
  const h = harness([visit(1, 'besakih', 'give'), visit(2, 'besakih', 'take')])
  await buildResolver(h.deps).resolveWindow(W)
  // 5000+100=5100; growth min(1020,2000)=1020 to the single giver; taker min(300,5100)=300 → 4800
  assert.equal(h.pools.besakih, 4800n)
  assert.deepEqual(h.paid.map(p => [p[0], p[1]]), [[1, 1020n], [2, 300n]])
})

test('a lost window claim skips the window', async () => {
  const h = harness([visit(1, 'ubud')], { claimWindow: async () => false })
  assert.equal(await buildResolver(h.deps).resolveWindow(W), 0)
  assert.deepEqual(h.paid, [])
})

test('at-most-once: a crash after the visit CAS is not paid twice on retry', async () => {
  let crashOnce = true
  const h = harness([visit(1, 'ubud'), visit(2, 'ubud')])
  const base = h.deps.addPoints
  h.deps.addPoints = async (u, a, r) => {
    await base(u, a, r)
    if (crashOnce) { crashOnce = false; throw new Error('db hiccup') }
  }
  const { resolveWindow } = buildResolver(h.deps)
  await assert.rejects(resolveWindow(W), /db hiccup/)
  await resolveWindow(W)
  assert.deepEqual(h.paid.map(p => p[0]), [1, 2])
})

test('notification failures never block payouts', async () => {
  const h = harness([visit(1, 'ubud')], { notify: async () => { throw new Error('blocked') } })
  await buildResolver(h.deps).resolveWindow(W)
  assert.equal(h.paid.length, 1)
  assert.match(h.errors[0], /blocked/)
})

test('tick resolves every past window oldest first and logs per-window errors', async () => {
  const h = harness([visit(1, 'ubud'), { ...visit(2, 'ubud'), windowId: W - 1 }])
  const order: number[] = []
  h.deps.claimWindow = async (id) => { order.push(id); if (id === W - 1) throw new Error('boom'); return true }
  await buildResolver(h.deps).tick()
  assert.deepEqual(order, [W - 1, W])
  assert.match(h.errors[0], /boom/)
  assert.equal(h.paid.length, 1)
})

test('visits at a closed or rest place are refunded', async () => {
  const h = harness([visit(1, 'kuta'), visit(2, 'sanur')])
  await buildResolver(h.deps).resolveWindow(W)
  assert.deepEqual(h.paid.map(p => [p[0], p[1], p[2]]), [[1, 100n, BalanceChangeType.Stake], [2, 100n, BalanceChangeType.Stake]])
})
