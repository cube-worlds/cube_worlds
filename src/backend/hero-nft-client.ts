import { config } from '#root/config'

export function isHeroMintEnabled(): boolean {
  return config.HERO_COLLECTION_ADDRESS.length > 0
}

// Mints a Hero NFT (soulbound for the first hero) against HERO_COLLECTION_ADDRESS.
// Reuse the CNFT mint sign/send flow; do not author contract code in-tree.
export async function mintHeroNft(_heroId: unknown, _userId: number): Promise<string> {
  throw new Error('mintHeroNft: implement against the deployed collection (see Task 11 Step 0)')
}
