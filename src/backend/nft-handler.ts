/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable unicorn/numeric-separators-style */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { getCNFTByIndex } from "#root/bot/models/cnft";
import { FastifyInstance } from "fastify";

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
      image: `https://cubeworlds.club/api/nft/${nft.image.toLowerCase()}_${nft.color.toLowerCase()}.png`,
      attributes: [
        { trait_type: "Type", value: nft.image },
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

  fastify.get("/:image-:color.png", (request: any, _reply: any) => {
    const { image, color } = request.params;
    if (!image || !color) {
      return { error: "No correct image/color provided!" };
    }
    return { image, color };
  });

  done();
};
export default nftHandler;
