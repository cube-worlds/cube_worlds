import { config } from "#root/config.js";
import pinataSDK from "@pinata/sdk";
import { Readable } from "node:stream";
import { saveImage, saveJSON } from "#root/bot/helpers/files";

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
