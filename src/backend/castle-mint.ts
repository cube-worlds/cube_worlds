export interface UnmintedCastle {
  _id: unknown
  userId: number
}

export interface CastleMintDependencies {
  batchSize: number
  findUnmintedCastles: (limit: number) => Promise<UnmintedCastle[]>
  // Mints the Castle NFT for userId on-chain; returns the new item address.
  mintCastleNft: (userId: number) => Promise<string>
  markCastleMinted: (castleId: unknown, address: string) => Promise<void>
  logInfo: (message: string) => void
  logError: (message: string) => void
}

// Pure: which castles to mint this pass.
export function planCastleMints(
  unminted: UnmintedCastle[],
  batchSize: number,
): UnmintedCastle[] {
  return unminted.slice(0, batchSize)
}

export function buildCastleMintRunner(deps: CastleMintDependencies) {
  let running = false
  async function runOnce(): Promise<void> {
    // Re-entrancy guard: the 5-min interval in main.ts can fire again while a
    // slow batch of on-chain mints is still in flight. Without this, the second
    // tick re-queries the same not-yet-flipped castles and mints them twice.
    if (running) return
    running = true
    try {
      const unminted = await deps.findUnmintedCastles(deps.batchSize)
      const batch = planCastleMints(unminted, deps.batchSize)
      let ok = 0
      for (const castle of batch) {
        try {
          // Mint BEFORE flipping the flag. A crash in the gap re-mints next pass
          // (operator-funded cosmetic — prefer a rare double-mint over silently
          // skipping a player). Same bias as the Plan-1 settlement credit pass.
          const address = await deps.mintCastleNft(castle.userId)
          await deps.markCastleMinted(castle._id, address)
          ok++
        } catch (err) {
          deps.logError(`Castle mint failed for ${castle.userId}: ${(err as Error).message}`)
        }
      }
      if (ok > 0) deps.logInfo(`Castle mint: minted ${ok}/${batch.length}`)
    } finally {
      running = false
    }
  }
  return { runOnce }
}

export const DEFAULT_CASTLE_MINT_BATCH = 10
