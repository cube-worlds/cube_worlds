/* eslint-disable @typescript-eslint/no-explicit-any */
import { User, findWhales } from "#root/bot/models/user";
import { Address } from "@ton/core";

const cnft = (fastify: any, _options: any, done: () => void) => {
  fastify.get("/items/:index?", async (request: any, _reply: any) => {
    const { index: index_ } = request.params;
    if (index_) {
      return {
        item: {
          metadata: {
            owner:
              "0:0000000000000000000000000000000000000000000000000000000000000000",
            individual_content: "te6cckEBAQEACAAADDAuanNvbuTiyMU=",
          },
          index_,
        },
        proof_cell:
          "te6cckEBBgEAeQACAAEDAUOAFa1KqA2Oswxbo4Rgh/q6NEaPLuK9o3fo1TFGn+MySjqQAgAMMi5qc29uAUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQBQF4S3GMDJY/HoZd6TCREIOnCaYlF23hNzJaSsfMd1S7nBQAA8muEeQ==",
      };
    }
    const users = await findWhales(10_000);
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
