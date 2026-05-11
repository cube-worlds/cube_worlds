import type { Address , Cell} from '@ton/core'
import { Buffer } from 'node:buffer'
import { beginCell } from '@ton/core'

export interface NFTMintParameters {
  queryId: number
  itemOwnerAddress: Address
  itemIndex: number
  amount: bigint
  commonContentUrl: string
}

export function createMintBody(parameters: NFTMintParameters): Cell {
  const body = beginCell()
  body.storeUint(1, 32)
  body.storeUint(parameters.queryId || 0, 64)
  body.storeUint(parameters.itemIndex, 64)
  body.storeCoins(parameters.amount)

  const nftItemContent = beginCell()
  nftItemContent.storeAddress(parameters.itemOwnerAddress)

  const uriContent = beginCell()
  uriContent.storeBuffer(Buffer.from(parameters.commonContentUrl))
  nftItemContent.storeRef(uriContent.endCell())

  body.storeRef(nftItemContent.endCell())
  return body.endCell()
}
