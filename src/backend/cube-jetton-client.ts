import { Address } from '@ton/core'
import { config } from '#root/config'

// The single config+chain seam for the $CUBE bridge (no test imports this).
// Mirrors xrocket-client.ts: wraps an already-deployed jetton master + vault.

export function isCubeJettonEnabled(): boolean {
  return config.CUBE_JETTON_MASTER.length > 0 && config.CUBE_VAULT_ADDRESS.length > 0
}

export function cubeVaultAddress(): Address {
  return Address.parse(config.CUBE_VAULT_ADDRESS)
}

// Sends `net` micro-CUBE jettons from the vault to `toWallet`. Returns the chain
// tx hash. Implement using the same wallet + tonClient send pattern as the CNFT
// queue mint (src/bot/features/admin/queue.ts).
export async function sendCubeJetton(_toWallet: string, _net: bigint): Promise<string> {
  throw new Error('sendCubeJetton: implement against the deployed vault (see Task 11 Step 0)')
}
