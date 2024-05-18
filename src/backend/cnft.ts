/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable unicorn/numeric-separators-style */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { User, findWhales } from "#root/bot/models/user";
import { Address } from "@ton/core";

const cnft = (fastify: any, _options: any, done: () => void) => {
  //   const body = beginCell()
  //     .storeUint(0xf8a7ea5, 32)
  //     .storeUint(0, 64)
  //     .storeCoins(1000000)
  //     .storeAddress(Address.parse(""))
  //     .storeUint(0, 1)
  //     .storeCoins(toNano(0.05))
  //     .storeUint(0, 1)
  //     .endCell();
  //   const payload = body.toBoc().toString("base64");

  fastify.get("/items/:index?", async (request: any, _reply: any) => {
    const users = await findWhales(10);
    const { index: index_ } = request.params;
    if (index_) {
      const index = users.findIndex((_, index__) => index__ === index_);
      return {
        item: {
          metadata: {
            owner:
              "0:0000000000000000000000000000000000000000000000000000000000000000",
            individual_content: "te6cckEBAQEACAAADDAuanNvbuTiyMU=",
          },
          index,
        },
        proof_cell:
          "te6cckEBBgEAeQACAAEDAUOAFa1KqA2Oswxbo4Rgh/q6NEaPLuK9o3fo1TFGn+MySjqQAgAMMi5qc29uAUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQBQF4S3GMDJY/HoZd6TCREIOnCaYlF23hNzJaSsfMd1S7nBQAA8muEeQ==",
      };
    }
    const items = users.map((u: User, index: number) => {
      return {
        metadata: {
          owner: Address.parse(u.wallet!).toRawString(),
          individual_content: "cell",
        },
        index,
      };
    });
    return { items, last_index: users.length - 1 };
  });
  done();
};
export default cnft;
