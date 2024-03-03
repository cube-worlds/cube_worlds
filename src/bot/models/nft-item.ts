import { Address, beginCell, Cell, internal, SendMode } from "ton-core";
import { OpenedWallet } from "#root/bot/helpers/ton.js";
import { config } from "#root/config";

export type nftMintParameters = {
  queryId: number;
  itemOwnerAddress: Address;
  itemIndex: number;
  amount: bigint;
  commonContentUrl: string;
};

export class NftItem {
  public async deploy(
    wallet: OpenedWallet,
    parameters: nftMintParameters,
  ): Promise<number> {
    const collectionAddress = Address.parse(config.COLLECTION_ADDRESS);
    const seqno = await wallet.contract.getSeqno();
    await wallet.contract.sendTransfer({
      seqno,
      secretKey: wallet.keyPair.secretKey,
      messages: [
        internal({
          value: "0.05",
          to: collectionAddress,
          body: this.createMintBody(parameters),
        }),
      ],
      sendMode: SendMode.IGNORE_ERRORS + SendMode.PAY_GAS_SEPARATELY,
    });
    return seqno;
  }

  // eslint-disable-next-line class-methods-use-this
  public createMintBody(parameters: nftMintParameters): Cell {
    const body = beginCell();
    body.storeUint(1, 32);
    body.storeUint(parameters.queryId || 0, 64);
    body.storeUint(parameters.itemIndex, 64);
    body.storeCoins(parameters.amount);

    const nftItemContent = beginCell();
    nftItemContent.storeAddress(parameters.itemOwnerAddress);

    const uriContent = beginCell();
    uriContent.storeBuffer(Buffer.from(parameters.commonContentUrl));
    nftItemContent.storeRef(uriContent.endCell());

    body.storeRef(nftItemContent.endCell());
    return body.endCell();
  }
}
