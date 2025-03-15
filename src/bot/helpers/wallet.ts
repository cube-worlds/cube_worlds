import type { OpenedContract } from '@ton/core'
import type { KeyPair } from '@ton/crypto'
import type { WalletContractV4 } from '@ton/ton'

export interface OpenedWallet {
  contract: OpenedContract<WalletContractV4>
  keyPair: KeyPair
}
