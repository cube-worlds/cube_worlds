/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable unicorn/numeric-separators-style */
/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  CNFTImageType,
  cnftHexColor,
  getCNFTByIndex,
} from "#root/bot/models/cnft";
import { logger } from "#root/logger";
import { FastifyInstance } from "fastify";
import sharp from "sharp";

function nftImage(type: CNFTImageType) {
  if (type === CNFTImageType.Dice) {
    return "dice";
  }
  if (type === CNFTImageType.Whale) {
    return "whale";
  }
  if (type === CNFTImageType.Diamond) {
    return "diamond";
  }
  if (type === CNFTImageType.Coin) {
    return "coin";
  }
  if (type === CNFTImageType.Knight) {
    return "knight";
  }
  return "common";
}

const nftHandler = (
  fastify: FastifyInstance,
  _options: any,
  done: () => void,
) => {
  fastify.get("/:index.json", async (request: any, _reply: any) => {
    const { index } = request.params;
    if (!index) {
      return { error: "No index provided" };
    }
    const nft = await getCNFTByIndex(index);
    if (!nft) {
      return { error: "NFT doesn't exists" };
    }
    const json = {
      name: `Cube Worlds Citizen #${index}`,
      description:
        "Thank you for your participation in the Cube Worlds Project!",
      image: `https://cubeworlds.club/api/nft/${nft.type.toLowerCase()}-${nft.color}.webp`,
      attributes: [
        { trait_type: "Type", value: nft.type },
        { trait_type: "Color", value: nft.color },
      ],
      buttons: [
        {
          label: "Explore Cube Worlds",
          uri: "https://t.me/cube_worlds_bot",
        },
      ],
    };
    return json;
  });

  fastify.get("/:image-:color.webp", async (request: any, reply: any) => {
    const { image, color } = request.params;
    if (!image || !color) {
      return { error: "No correct image/color provided!" };
    }
    const capitalizedImage = image.charAt(0).toUpperCase() + image.slice(1);
    const typedImage = capitalizedImage as keyof typeof CNFTImageType;
    const type = CNFTImageType[typedImage];
    const imageName = nftImage(type);
    logger.info(capitalizedImage, typedImage, type, imageName);
    const data = await sharp(`./src/backend/nft/${imageName}.png`)
      .flatten({ background: cnftHexColor(Number(color)) })
      .webp({ nearLossless: true, quality: 100 })
      .toBuffer();

    reply.header("Content-Type", "image/webp");
    reply.header("Content-Length", data.length);
    reply.type("image/webp");
    reply.send(data);
  });

  done();
};
export default nftHandler;
