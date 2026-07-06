import type { FastifyInstance } from 'fastify'

export interface PublicMetrics {
  players: number
  minted: number
  paidOutMicroUsdt: string
  activeWeek: number
}

export interface PublicMetricsHandlerDependencies {
  fetchMetrics: () => Promise<PublicMetrics>
  now: () => number
  cacheTtlMs: number
}

function createDefaultDependencies(): PublicMetricsHandlerDependencies {
  // Real data-fetchers are injected by the composer (public-metrics.ts) to
  // keep this module free of any #root/config transitive import.
  return {
    fetchMetrics: () =>
      Promise.resolve({ players: 0, minted: 0, paidOutMicroUsdt: '0', activeWeek: 0 }),
    now: () => Date.now(),
    cacheTtlMs: 60_000,
  }
}

export function buildPublicMetricsHandler(
  dependencies: PublicMetricsHandlerDependencies = createDefaultDependencies(),
) {
  let cached: { at: number, value: PublicMetrics } | null = null

  return async function publicMetricsHandler(fastify: FastifyInstance) {
    fastify.get('/metrics', async () => {
      if (cached && dependencies.now() - cached.at < dependencies.cacheTtlMs) {
        return cached.value
      }
      const value = await dependencies.fetchMetrics()
      cached = { at: dependencies.now(), value }
      return value
    })
  }
}

const publicMetricsHandler = buildPublicMetricsHandler()

export default publicMetricsHandler
