import {
  Address,
  Cell,
  internal,
  beginCell,
  contractAddress,
  StateInit,
  SendMode,
} from "@ton/core";
import {
  encodeOffChainContent,
  sleep,
  tonClient,
} from "#root/bot/helpers/ton.js";
import { config } from "#root/config.js";
import { logger } from "#root/logger";
import { OpenedWallet } from "../helpers/wallet";

export type collectionData = {
  ownerAddress: Address;
  royaltyPercent: number;
  royaltyAddress: Address;
  nextItemIndex: number;
  collectionContentUrl: string; // path to collection.json
  commonContentUrl: string; // base url with ended /
};

export class NftCollection {
  private data: collectionData;

  constructor(data: collectionData) {
    this.data = data;
  }

  static async fetchNextItemIndexWithRetry(): Promise<number> {
    const maxRetryCount = 10;
    let attempts = 0;
    while (attempts < maxRetryCount) {
      try {
        // eslint-disable-next-line no-await-in-loop
        const nextItemIndex = await NftCollection.fetchNextItemIndex();
        return nextItemIndex;
      } catch (error) {
        logger.error(`Fetch collection item index failed: ${error}`);
        attempts += 1;
        if (attempts < maxRetryCount) {
          // eslint-disable-next-line no-await-in-loop
          await sleep(2000);
        }
      }
    }
    throw new Error("Exceeded collection item index retries");
  }

  private static async fetchNextItemIndex(): Promise<number> {
    const nftCollectionAddress = Address.parse(config.COLLECTION_ADDRESS);

    const { stack } = await tonClient.runMethod(
      nftCollectionAddress,
      "get_collection_data",
    );
    const nextItemIndex = stack.readBigNumber();
    return Number(nextItemIndex);
  }

  static async getNftAddressByIndex(itemIndex: number): Promise<Address> {
    const collectionAddress = Address.parse(config.COLLECTION_ADDRESS);
    const response = await tonClient.runMethod(
      collectionAddress,
      "get_nft_address_by_index",
      [{ type: "int", value: BigInt(itemIndex) }],
    );
    return response.stack.readAddress();
  }

  public async deploy(wallet: OpenedWallet): Promise<number> {
    const seqno = await wallet.contract.getSeqno();
    await wallet.contract.sendTransfer({
      seqno,
      secretKey: wallet.keyPair.secretKey,
      messages: [
        internal({
          value: "0.05",
          to: this.address,
          init: this.stateInit,
        }),
      ],
      sendMode: SendMode.PAY_GAS_SEPARATELY + SendMode.IGNORE_ERRORS,
    });
    return seqno;
  }

  public get stateInit(): StateInit {
    const code = this.createCodeCell();
    const data = this.createDataCell();

    return { code, data };
  }

  public get address(): Address {
    return contractAddress(0, this.stateInit);
  }

  // eslint-disable-next-line class-methods-use-this
  private createCodeCell(): Cell {
    const NftCollectionCodeBoc =
      "te6cckECFAEAAh8AART/APSkE/S88sgLAQIBYgkCAgEgBAMAJbyC32omh9IGmf6mpqGC3oahgsQCASAIBQIBIAcGAC209H2omh9IGmf6mpqGAovgngCOAD4AsAAvtdr9qJofSBpn+pqahg2IOhph+mH/SAYQAEO4tdMe1E0PpA0z/U1NQwECRfBNDUMdQw0HHIywcBzxbMyYAgLNDwoCASAMCwA9Ra8ARwIfAFd4AYyMsFWM8WUAT6AhPLaxLMzMlx+wCAIBIA4NABs+QB0yMsCEsoHy//J0IAAtAHIyz/4KM8WyXAgyMsBE/QA9ADLAMmAE59EGOASK3wAOhpgYC42Eit8H0gGADpj+mf9qJofSBpn+pqahhBCDSenKgpQF1HFBuvgoDoQQhUZYBWuEAIZGWCqALnixJ9AQpltQnlj+WfgOeLZMAgfYBwGyi544L5cMiS4ADxgRLgAXGBEuAB8YEYGYHgAkExIREAA8jhXU1DAQNEEwyFAFzxYTyz/MzMzJ7VTgXwSED/LwACwyNAH6QDBBRMhQBc8WE8s/zMzMye1UAKY1cAPUMI43gED0lm+lII4pBqQggQD6vpPywY/egQGTIaBTJbvy9AL6ANQwIlRLMPAGI7qTAqQC3gSSbCHis+YwMlBEQxPIUAXPFhPLP8zMzMntVABgNQLTP1MTu/LhklMTugH6ANQwKBA0WfAGjhIBpENDyFAFzxYTyz/MzMzJ7VSSXwXiN0CayQ==";
    return Cell.fromBase64(NftCollectionCodeBoc);
  }

  private createDataCell(): Cell {
    const { data } = this;
    const dataCell = beginCell();

    dataCell.storeAddress(data.ownerAddress);
    dataCell.storeUint(data.nextItemIndex, 64);

    const contentCell = beginCell();

    const collectionContent = encodeOffChainContent(data.collectionContentUrl);

    const commonContent = beginCell();
    commonContent.storeBuffer(Buffer.from(data.commonContentUrl));

    contentCell.storeRef(collectionContent);
    contentCell.storeRef(commonContent.asCell());
    dataCell.storeRef(contentCell);

    const NftItemCodeCell = Cell.fromBase64(
      "te6cckECDQEAAdAAART/APSkE/S88sgLAQIBYgMCAAmhH5/gBQICzgcEAgEgBgUAHQDyMs/WM8WAc8WzMntVIAA7O1E0NM/+kAg10nCAJp/AfpA1DAQJBAj4DBwWW1tgAgEgCQgAET6RDBwuvLhTYALXDIhxwCSXwPg0NMDAXGwkl8D4PpA+kAx+gAxcdch+gAx+gAw8AIEs44UMGwiNFIyxwXy4ZUB+kDUMBAj8APgBtMf0z+CEF/MPRRSMLqOhzIQN14yQBPgMDQ0NTWCEC/LJqISuuMCXwSED/LwgCwoAcnCCEIt3FzUFyMv/UATPFhAkgEBwgBDIywVQB88WUAX6AhXLahLLH8s/Im6zlFjPFwGRMuIByQH7AAH2UTXHBfLhkfpAIfAB+kDSADH6AIIK+vCAG6EhlFMVoKHeItcLAcMAIJIGoZE24iDC//LhkiGOPoIQBRONkchQCc8WUAvPFnEkSRRURqBwgBDIywVQB88WUAX6AhXLahLLH8s/Im6zlFjPFwGRMuIByQH7ABBHlBAqN1viDACCAo41JvABghDVMnbbEDdEAG1xcIAQyMsFUAfPFlAF+gIVy2oSyx/LPyJus5RYzxcBkTLiAckB+wCTMDI04lUC8ANqhGIu",
    );
    dataCell.storeRef(NftItemCodeCell);

    const royaltyBase = 1000;
    const royaltyFactor = Math.floor(data.royaltyPercent * royaltyBase);

    const royaltyCell = beginCell();
    royaltyCell.storeUint(royaltyFactor, 16);
    royaltyCell.storeUint(royaltyBase, 16);
    royaltyCell.storeAddress(data.royaltyAddress);
    dataCell.storeRef(royaltyCell);

    return dataCell.endCell();
  }
}
