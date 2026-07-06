/* eslint-disable test/no-import-node-test */
import type { PublicMetricsHandlerDependencies } from '#root/backend/public-metrics-handler'
import assert from 'node:assert/strict'
import test from 'node:test'
import fastify from 'fastify'
import { buildPublicMetricsHandler } from '#root/backend/public-metrics-handler'

function ctx(overrides: Partial<PublicMetricsHandlerDependencies> = {}) {
  let calls = 0
  let clock = 1000
  const deps: PublicMetricsHandlerDependencies = {
    fetchMetrics: () => {
      calls += 1
      return Promise.resolve({ players: 10, minted: 3, paidOutMicroUsdt: '5000000', activeWeek: 4 })
    },
    now: () => clock,
    cacheTtlMs: 60_000,
    ...overrides,
  }
  const app = fastify()
  return {
    app,
    deps,
    get calls() {
      return calls
    },
    setClock: (v: number) => {
      clock = v
    },
  }
}

test('GET /metrics returns the metrics shape', async (t) => {
  const c = ctx()
  await c.app.register(buildPublicMetricsHandler(c.deps), { prefix: '/api/public' })
  t.after(() => c.app.close())
  const res = await c.app.inject({ method: 'GET', url: '/api/public/metrics' })
  assert.equal(res.statusCode, 200)
  assert.deepEqual(res.json(), { players: 10, minted: 3, paidOutMicroUsdt: '5000000', activeWeek: 4 })
})

test('caches within the TTL and refetches after it', async (t) => {
  const c = ctx()
  await c.app.register(buildPublicMetricsHandler(c.deps), { prefix: '/api/public' })
  t.after(() => c.app.close())
  await c.app.inject({ method: 'GET', url: '/api/public/metrics' })
  await c.app.inject({ method: 'GET', url: '/api/public/metrics' })
  assert.equal(c.calls, 1)
  c.setClock(1000 + 60_001)
  await c.app.inject({ method: 'GET', url: '/api/public/metrics' })
  assert.equal(c.calls, 2)
})
