import { TonClient } from "ton";
import { Address, beginCell, Cell, internal, SendMode, toNano } from "ton-core";
import { OpenedWallet } from "#root/bot/helpers/ton.js";
import { mintParameters } from "#root/bot/models/nft-collection.js";

export class NftItem {
  public async deploy(
    wallet: OpenedWallet,
    collectionAddress: Address,
    parameters: mintParameters,
  ): Promise<number> {
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
  public createMintBody(parameters: mintParameters): Cell {
    const body = beginCell();
    body.storeUint(1, 32);
    body.storeUint(parameters.queryId || 0, 64);
    body.storeUint(parameters.itemIndex, 64);
    body.storeCoins(parameters.amount);

    const nftItemContent = beginCell();
    nftItemContent.storeAddress(parameters.itemOwnerAddress);

    const uriContent = beginCell();
    uriContent.storeBuffer(Buffer.from(parameters.contentUri));
    nftItemContent.storeRef(uriContent.endCell());

    body.storeRef(nftItemContent.endCell());
    return body.endCell();
  }

  static async getAddressByIndex(
    collectionAddress: Address,
    itemIndex: number,
  ): Promise<Address> {
    const client = new TonClient({
      endpoint: "https://testnet.toncenter.com/api/v2/jsonRPC",
      apiKey: process.env.TONCENTER_API_KEY,
    });
    const response = await client.runMethod(
      collectionAddress,
      "get_nft_address_by_index",
      [{ type: "int", value: BigInt(itemIndex) }],
    );
    return response.stack.readAddress();
  }

  static async transfer(
    wallet: OpenedWallet,
    nftAddress: Address,
    newOwner: Address,
  ): Promise<number> {
    const seqno = await wallet.contract.getSeqno();

    await wallet.contract.sendTransfer({
      seqno,
      secretKey: wallet.keyPair.secretKey,
      messages: [
        internal({
          value: "0.05",
          to: nftAddress,
          body: this.createTransferBody({
            newOwner,
            responseTo: wallet.contract.address,
            forwardAmount: toNano("0.02"),
          }),
        }),
      ],
      sendMode: SendMode.IGNORE_ERRORS + SendMode.PAY_GAS_SEPARATELY,
    });
    return seqno;
  }

  static createTransferBody(parameters: {
    newOwner: Address;
    responseTo?: Address;
    forwardAmount?: bigint;
  }): Cell {
    const messageBody = beginCell();
    messageBody.storeUint(0x5f_cc_3d_14, 32);
    messageBody.storeUint(0, 64);
    messageBody.storeAddress(parameters.newOwner);
    // eslint-disable-next-line unicorn/no-null
    messageBody.storeAddress(parameters.responseTo || null);
    messageBody.storeBit(false); // no custom payload
    messageBody.storeCoins(parameters.forwardAmount || 0);
    messageBody.storeBit(0); // no forward_payload

    return messageBody.endCell();
  }
}
