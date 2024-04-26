import { config } from "#root/config.js";
import pinataSDK from "@pinata/sdk";
import { Readable } from "node:stream";
import { saveImage, saveJSON } from "#root/bot/helpers/files";
import fetch from "node-fetch";
import { logger } from "#root/logger";

// eslint-disable-next-line new-cap
const pinata = new pinataSDK({
  pinataApiKey: config.PINATA_API_KEY,
  pinataSecretApiKey: config.PINATA_API_SECRET,
});

export async function pinImageURLToIPFS(
  adminIndex: number,
  itemIndex: number,
  imageURL: string,
): Promise<string> {
  const image = await fetch(imageURL);
  const arrayBuffer = await image.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const imageFileName =
    imageURL.slice((imageURL.lastIndexOf("/") ?? 0) + 1) ?? "";
  const fileExtension = imageFileName.split(".").pop();
  const newFileName = `${adminIndex}_${itemIndex}.${fileExtension}`;
  saveImage(itemIndex, newFileName, buffer);

  const stream = Readable.from(buffer);
  const response = await pinata.pinFileToIPFS(stream, {
    pinataMetadata: { name: newFileName },
  });
  return response.IpfsHash;
}

export async function pinJSONToIPFS(
  adminIndex: number,
  itemIndex: number,
  json: object,
): Promise<string> {
  const jsonPath = saveJSON(adminIndex, itemIndex, json);
  const response = await pinata.pinFromFS(jsonPath, {
    pinataMetadata: { name: `${adminIndex}_${itemIndex}.json` },
  });
  return response.IpfsHash;
}

export async function unpin(hash: string) {
  return pinata.unpin(hash);
}

export function linkToIPFSGateway(hash: string) {
  return `${config.PINATA_GATEWAY}/ipfs/${hash}?pinataGatewayToken=${config.PINATA_GATEWAY_KEY}`;
}

async function fetchFileFromIPFS(
  cid: string,
  gateway: string,
): Promise<Buffer> {
  const response = await fetch(`${gateway}${cid}`, {
    signal: AbortSignal.timeout(120_000),
  });
  if (!response.ok) {
    throw new Error(`HTTP error! Status: ${response.status}`);
  }
  const fileData = await response.arrayBuffer();
  return Buffer.from(fileData);
}

export function warmIPFSHash(hash: string) {
  // https://ipfs.github.io/public-gateway-checker/
  const gateways = [
    "https://ipfs.io/ipfs/",
    "https://dweb.link/ipfs/",
    "https://ipfs.eth.aragon.network/ipfs/",
    "https://gateway.pinata.cloud/ipfs/",
    "https://ipfs.eth.aragon.network/ipfs/",
  ];
  // eslint-disable-next-line no-restricted-syntax
  for (const gateway of gateways) {
    fetchFileFromIPFS(hash, gateway)
      .then((_) => logger.debug(`Gateway ${gateway} warmed`))
      .catch((error) =>
        logger.debug(`Gateway ${gateway} NOT warmed: ${error}`),
      );
  }
}
