import { config } from '#root/config'

// Config+chain seam for Castle NFT minting (no test imports this). Mirrors
// xrocket-client.ts: wraps an already-deployed collection.
export function isCastleMintEnabled(): boolean {
  return config.CASTLE_COLLECTION_ADDRESS.length > 0
}

// Mints a Castle NFT to the user's bound wallet against CASTLE_COLLECTION_ADDRESS
// and returns the new item address. Reuse the CNFT mint sign/send flow in
// src/bot/features/admin/queue.ts rather than re-implementing it.
export async function mintCastleNft(_userId: number): Promise<string> {
  throw new Error('mintCastleNft: implement against the deployed collection (see Task 10 Step 0)')
}
