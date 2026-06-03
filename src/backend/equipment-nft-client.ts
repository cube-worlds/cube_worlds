import { config } from '#root/config'

export function isEquipmentMintEnabled(): boolean {
  return config.EQUIPMENT_COLLECTION_ADDRESS.length > 0
}

// Mints an Equipment NFT (transferable, TEP-62) against EQUIPMENT_COLLECTION_ADDRESS.
// Reuse the CNFT mint sign/send flow; do not author contract code in-tree.
export async function mintEquipmentNft(_equipmentId: unknown, _userId: number): Promise<string> {
  throw new Error('mintEquipmentNft: implement against the deployed collection')
}
