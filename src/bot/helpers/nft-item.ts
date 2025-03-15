import type { OpenedWallet } from '#root/bot/helpers/wallet.js'
import type { Cell } from '@ton/core'
import { Buffer } from 'node:buffer'
import { NftCollection } from '#root/bot/helpers/nft-collection.js'
import { openWallet, waitSeqno } from '#root/bot/helpers/ton.js'
import { config } from '#root/config.js'
import { logger } from '#root/logger.js'
import { Address, beginCell, internal, SendMode, toNano } from '@ton/core'
import { sleep } from './time'

export interface NFTMintParameters {
  queryId: number
  itemOwnerAddress: Address
  itemIndex: number
  amount: bigint
  commonContentUrl: string
}

export class NftItem {
  public async deployNFT(parameters: NFTMintParameters): Promise<string> {
    const wallet = await openWallet(config.MNEMONICS.split(' '))
    const seqno = await wallet.contract.getSeqno()
    const maxAttempts = 30
    let attemptsCount = 0
    while (attemptsCount < maxAttempts) {
      try {
        await this.deploy(wallet, seqno, parameters)
        await waitSeqno(seqno, wallet)
        break // If waitSeqno succeeds, break out of the loop
      }
      catch (error) {
        attemptsCount += 1
        logger.error(`Attempt ${attemptsCount} failed: ${error}`)
        await sleep(5000)
      }
    }
    if (attemptsCount === maxAttempts) {
      throw new Error(`NFT not minted with ${attemptsCount} attempts.`)
    }

    const nft = await NftCollection.getNftAddressByIndex(parameters.itemIndex)
    const nftUrl = `https://${config.TESTNET ? 'testnet.' : ''}getgems.io/collection/${config.COLLECTION_ADDRESS}/${nft.toString()}`
    return nftUrl
  }

  private async deploy(wallet: OpenedWallet, seqno: number, parameters: NFTMintParameters) {
    logger.info(`Deploy NFT with seqno ${seqno} was started.`)
    const collectionAddress = Address.parse(config.COLLECTION_ADDRESS)
    await wallet.contract.sendTransfer({
      seqno,
      secretKey: wallet.keyPair.secretKey,
      messages: [
        internal({
          value: toNano('0.026'),
          to: collectionAddress,
          body: this.createMintBody(parameters),
        }),
      ],
      sendMode: SendMode.IGNORE_ERRORS + SendMode.PAY_GAS_SEPARATELY,
    })
  }

  private createMintBody(parameters: NFTMintParameters): Cell {
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
}
