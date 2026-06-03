export interface UnmintedEquipment {
  _id: unknown
  userId: number
}

export interface EquipmentMintDependencies {
  batchSize: number
  findUnmintedEquipment: (limit: number) => Promise<UnmintedEquipment[]>
  mintEquipmentNft: (equipmentId: unknown, userId: number) => Promise<string>
  markEquipmentMinted: (equipmentId: unknown, address: string) => Promise<void>
  logInfo: (message: string) => void
  logError: (message: string) => void
}

export function planEquipmentMints(unminted: UnmintedEquipment[], batchSize: number): UnmintedEquipment[] {
  return unminted.slice(0, batchSize)
}

export function buildEquipmentMintRunner(deps: EquipmentMintDependencies) {
  let running = false
  async function runOnce(): Promise<void> {
    // Re-entrancy guard from the start (the Phase A castle mint learned this the
    // hard way): the main.ts interval can fire again mid-batch, and without the
    // guard the second tick re-queries the same not-yet-flipped items and
    // double-mints them.
    if (running) return
    running = true
    try {
      const unminted = await deps.findUnmintedEquipment(deps.batchSize)
      const batch = planEquipmentMints(unminted, deps.batchSize)
      let ok = 0
      for (const item of batch) {
        try {
          // Mint BEFORE flipping (operator-funded; prefer a rare double-mint on
          // crash over silently skipping an item). Same bias as the hero/castle mint.
          const address = await deps.mintEquipmentNft(item._id, item.userId)
          await deps.markEquipmentMinted(item._id, address)
          ok++
        } catch (err) {
          deps.logError(`Equipment mint failed for ${item.userId}: ${(err as Error).message}`)
        }
      }
      if (ok > 0) deps.logInfo(`Equipment mint: minted ${ok}/${batch.length}`)
    } finally {
      running = false
    }
  }
  return { runOnce }
}

export const DEFAULT_EQUIPMENT_MINT_BATCH = 10
