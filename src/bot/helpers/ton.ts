/* eslint-disable no-plusplus */
/* eslint-disable no-use-before-define */
/* eslint-disable no-await-in-loop */
import { KeyPair, mnemonicToPrivateKey } from "@ton/crypto";
import {
  beginCell,
  Cell,
  OpenedContract,
  TonClient,
  WalletContractV4,
} from "@ton/ton";
import { config } from "#root/config.js";

export type OpenedWallet = {
  contract: OpenedContract<WalletContractV4>;
  keyPair: KeyPair;
};

const toncenterBaseEndpoint: string = config.TESTNET
  ? "https://testnet.toncenter.com"
  : "https://toncenter.com";

export const tonClient = new TonClient({
  endpoint: `${toncenterBaseEndpoint}/api/v2/jsonRPC`,
  apiKey: process.env.TONCENTER_API_KEY,
});

export async function openWallet(mnemonic: string[]) {
  const keyPair = await mnemonicToPrivateKey(mnemonic);

  const wallet = WalletContractV4.create({
    workchain: 0,
    publicKey: keyPair.publicKey,
  });

  const contract = tonClient.open(wallet);
  return { contract, keyPair };
}

function bufferToChunks(buff: Buffer, chunkSize: number) {
  const chunks: Buffer[] = [];
  while (buff.byteLength > 0) {
    chunks.push(buff.slice(0, chunkSize));
    // eslint-disable-next-line no-param-reassign
    buff = buff.slice(chunkSize);
  }
  return chunks;
}

function makeSnakeCell(data: Buffer): Cell {
  const chunks = bufferToChunks(data, 127);

  if (chunks.length === 0) {
    return beginCell().endCell();
  }

  if (chunks.length === 1) {
    return beginCell().storeBuffer(chunks[0]).endCell();
  }

  let currentCell = beginCell();

  // eslint-disable-next-line no-plusplus
  for (let index = chunks.length - 1; index >= 0; index--) {
    const chunk = chunks[index];

    currentCell.storeBuffer(chunk);

    if (index - 1 >= 0) {
      const nextCell = beginCell();
      nextCell.storeRef(currentCell);
      currentCell = nextCell;
    }
  }

  return currentCell.endCell();
}

export function encodeOffChainContent(content: string) {
  let data = Buffer.from(content);
  const offChainPrefix = Buffer.from([0x01]);
  data = Buffer.concat([offChainPrefix, data]);
  return makeSnakeCell(data);
}

export async function waitSeqno(seqno: number, wallet: OpenedWallet) {
  for (let attempt = 0; attempt < 10; attempt++) {
    await sleep(2000);
    const seqnoAfter = await wallet.contract.getSeqno();
    if (seqnoAfter === seqno + 1) break;
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
