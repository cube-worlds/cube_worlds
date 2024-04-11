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
  fs.writeFileSync(filePath, content);
  return filePath;
}

export async function saveImageFromUrl(
  imageURL: string,
  adminIndex: number,
  index: number,
  original: boolean,
): Promise<string> {
  const image = await fetch(imageURL);
  const arrayBuffer = await image.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const imageFileName =
    imageURL.slice((imageURL.lastIndexOf("/") ?? 0) + 1) ?? "";
  const fileExtension = imageFileName.split(".").pop();
  const newFileName = `${original ? "ava_" : ""}${adminIndex}_${index}.${fileExtension}`;
  return saveImage(index, newFileName, buffer);
}

export function saveJSON(
  adminIndex: number,
  itemIndex: number,
  json: object,
): string {
  const jsonPath = path.join(
    folderPath(itemIndex),
    `${adminIndex}_${itemIndex}.json`,
  );
  fs.writeFileSync(jsonPath, JSON.stringify(json));
  return jsonPath;
}
