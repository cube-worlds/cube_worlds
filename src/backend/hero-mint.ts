export interface UnmintedHero {
  _id: unknown
  userId: number
}

export interface HeroMintDependencies {
  batchSize: number
  findUnmintedHeroes: (limit: number) => Promise<UnmintedHero[]>
  mintHeroNft: (heroId: unknown, userId: number) => Promise<string>
  markHeroMinted: (heroId: unknown, address: string) => Promise<void>
  logInfo: (message: string) => void
  logError: (message: string) => void
}

export function planHeroMints(unminted: UnmintedHero[], batchSize: number): UnmintedHero[] {
  return unminted.slice(0, batchSize)
}

export function buildHeroMintRunner(deps: HeroMintDependencies) {
  let running = false
  async function runOnce(): Promise<void> {
    // Re-entrancy guard: the interval in main.ts can fire again while a slow
    // batch of on-chain mints is in flight — without this the second tick
    // re-queries the same not-yet-flipped heroes and mints them twice.
    if (running) return
    running = true
    try {
      const unminted = await deps.findUnmintedHeroes(deps.batchSize)
      const batch = planHeroMints(unminted, deps.batchSize)
      let ok = 0
      for (const hero of batch) {
        try {
          // Mint BEFORE flipping (operator-funded; prefer a rare double-mint on
          // crash over silently skipping a hero). Same bias as the castle mint.
          const address = await deps.mintHeroNft(hero._id, hero.userId)
          await deps.markHeroMinted(hero._id, address)
          ok++
        } catch (err) {
          deps.logError(`Hero mint failed for ${hero.userId}: ${(err as Error).message}`)
        }
      }
      if (ok > 0) deps.logInfo(`Hero mint: minted ${ok}/${batch.length}`)
    } finally {
      running = false
    }
  }
  return { runOnce }
}

export const DEFAULT_HERO_MINT_BATCH = 10
