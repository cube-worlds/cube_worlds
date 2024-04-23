/* eslint-disable no-plusplus */
/* eslint-disable no-use-before-define */
/* eslint-disable no-await-in-loop */
import { mnemonicToPrivateKey } from "@ton/crypto";
import {
  Address,
  beginCell,
  Cell,
  internal,
  SendMode,
  TonClient,
  WalletContractV4,
} from "@ton/ton";
import { config } from "#root/config.js";
import { OpenedWallet } from "./wallet";

const toncenterBaseEndpoint: string = config.TESTNET
  ? "https://testnet.toncenter.com"
  : "https://toncenter.com";

export const tonClient = new TonClient({
  endpoint: `${toncenterBaseEndpoint}/api/v2/jsonRPC`,
  apiKey: config.TONCENTER_API_KEY,
});

export async function openWallet(mnemonic: string[]): Promise<OpenedWallet> {
  const keyPair = await mnemonicToPrivateKey(mnemonic);

  const wallet = WalletContractV4.create({
    workchain: 0,
    publicKey: keyPair.publicKey,
  });

  const contract = tonClient.open(wallet);
  return { contract, keyPair };
}

export async function topUpBalance(
  wallet: OpenedWallet,
  address: Address,
  nftAmount: number,
): Promise<number> {
  const seqno = await wallet.contract.getSeqno();
  const amount = nftAmount * 0.026;

  await wallet.contract.sendTransfer({
    seqno,
    secretKey: wallet.keyPair.secretKey,
    messages: [
      internal({
        value: amount.toString(),
        to: address.toString({ bounceable: false }),
        body: new Cell(),
      }),
    ],
    sendMode: SendMode.PAY_GAS_SEPARATELY + SendMode.IGNORE_ERRORS,
  });

  return seqno;
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

export async function waitSeqno(
  seqno: number,
  wallet: OpenedWallet,
  maxAttempts = 100,
) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await sleep(2000);
    const seqnoAfter = await wallet.contract.getSeqno();
    if (seqnoAfter > seqno) {
      return;
    }
  }
  throw new Error(
    `Seqno wait failed. Check https://tonviewer.com/${config.COLLECTION_OWNER}`,
  );
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

const stopList = new Set([
  "EQA2JYPGPywx6Sn590nUd06B2HgOkFvJ-cCnTO6yTEdacbUG", // @wallet ?
  "UQBX63RAdgShn34EAFMV73Cut7Z15lUZd1hnVva68SEl7pGn", // MEXC
  "UQCFr3jo0DXpIBF82mVGFc3zcdRkSAtinhENPFMQ2FqzYv0E", // Huobi
  "UQDD8dqOzaj4zUK6ziJOo_G2lx6qf1TEktTRkFJ7T1c_fKne", // Bybit
  "UQBfAN7LfaUYgXZNw5Wc7GBgkEX2yhuJ5ka95J1JJwXXf9t5", // OKX
  "UQCA1BI4QRZ8qYmskSRDzJmkucGodYRTZCf_b9hckjla6Yug", // Kucoin
]);

export function isUserAddressValid(a: Address): boolean {
  const bounceableAddress = a.toString({ bounceable: true });
  const nonBounceableAddress = a.toString({ bounceable: false });
  if (stopList.has(bounceableAddress) || stopList.has(nonBounceableAddress)) {
    return false;
  }
  try {
    return a.workChain === 0 || a.workChain === -1;
  } catch {
    return false;
  }
}

export function tonToPoints(ton: number): bigint {
  let points = BigInt(Math.round(ton * 100_000));
  if (points === BigInt(0)) {
    points = BigInt(1);
  }
  return points;
}
