import fs from "node:fs";
import path from "node:path";

export function folderPath(index: number): string {
  const fp = `./data/${index}/`;
  if (!fs.existsSync(fp)) {
    fs.mkdirSync(fp, { recursive: true });
  }
  return fp;
}

export function saveImage(
  index: number,
  fileName: string,
  content: Buffer,
): string {
  const fp = folderPath(index);
  const filePath = path.join(fp, fileName);
  fs.writeFile(filePath, content, (_error) => {});
  return filePath;
}

export async function saveImageFromUrl(
  imageURL: string,
  index: number,
  original: boolean,
): Promise<string> {
  const image = await fetch(imageURL);
  const arrayBuffer = await image.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const imageFileName =
    imageURL.slice((imageURL.lastIndexOf("/") ?? 0) + 1) ?? "";
  const fileExtension = imageFileName.split(".").pop();
  const newFileName = `${original ? "ava_" : ""}${index}.${fileExtension}`;
  return saveImage(index, newFileName, buffer);
}

export function saveJSON(index: number, json: object): string {
  const jsonPath = path.join(folderPath(index), `${index}.json`);
  fs.writeFile(jsonPath, JSON.stringify(json), (_error) => {});
  return jsonPath;
}
