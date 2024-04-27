import fs from "node:fs";
import path from "node:path";

export function folderPath(username: string): string {
  const fp = `./data/${username}/`;
  if (!fs.existsSync(fp)) {
    fs.mkdirSync(fp, { recursive: true });
  }
  return fp;
}

export function saveImage(
  username: string,
  fileName: string,
  content: Buffer,
): string {
  const fp = folderPath(username);
  const filePath = path.join(fp, fileName);
  fs.writeFileSync(filePath, content);
  return filePath;
}

export async function saveImageFromUrl(
  imageURL: string,
  adminIndex: number,
  username: string,
  original: boolean,
): Promise<string> {
  const image = await fetch(imageURL);
  const arrayBuffer = await image.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const imageFileName =
    imageURL.slice((imageURL.lastIndexOf("/") ?? 0) + 1) ?? "";
  const fileExtension = imageFileName.split(".").pop();
  const newFileName = `${original ? "ava_" : ""}${username}_${adminIndex}.${fileExtension}`;
  return saveImage(username, newFileName, buffer);
}

export function saveJSON(
  adminIndex: number,
  username: string,
  json: object,
): string {
  const jsonPath = path.join(
    folderPath(username),
    `${username}_${adminIndex}.json`,
  );
  fs.writeFileSync(jsonPath, JSON.stringify(json));
  return jsonPath;
}
