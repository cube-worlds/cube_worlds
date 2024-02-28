import { config } from "#root/config.js";
import pinataSDK from "@pinata/sdk";
import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";

function folderPath(index: number): string {
  const fp = `./data/${index}/`;
  if (!fs.existsSync(fp)) {
    fs.mkdirSync(fp, { recursive: true });
  }
  return fp;
}

export async function pinFileToIPFS(
  index: number,
  imageURL: string,
): Promise<string> {
  // eslint-disable-next-line new-cap
  const pinata = new pinataSDK({
    pinataApiKey: config.PINATA_API_KEY,
    pinataSecretApiKey: config.PINATA_API_SECRET,
  });

  const image = await fetch(imageURL);
  const arrayBuffer = await image.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const fp = folderPath(index);
  const imageFileName =
    imageURL.slice((imageURL.lastIndexOf("/") ?? 0) + 1) ?? "";
  fs.writeFile(path.join(fp, imageFileName), buffer, (_error) => {});

  const stream = Readable.from(buffer);
  const response = await pinata.pinFileToIPFS(stream, {
    pinataMetadata: { name: imageFileName },
  });
  return response.IpfsHash;
}

export async function pinJSONToIPFS(
  index: number,
  json: object,
): Promise<string> {
  // eslint-disable-next-line new-cap
  const pinata = new pinataSDK({
    pinataApiKey: config.PINATA_API_KEY,
    pinataSecretApiKey: config.PINATA_API_SECRET,
  });
  const fp = folderPath(index);
  fs.writeFile(
    path.join(fp, `${index}.json`),
    JSON.stringify(json),
    (_error) => {},
  );

  const response = await pinata.pinJSONToIPFS(json, {
    pinataMetadata: { name: `${index}.json` },
  });
  return response.IpfsHash;
}
