import { logger } from "#root/logger";
import { Address, fromNano } from "@ton/core";
import { config } from "#root/config";
import TonWeb from "tonweb";
import { TransactionModel, getLastestTransaction } from "./models/transaction";
import { findUserByAddress } from "./models/user";

export class BlockchainSubscription {
  static client = new TonWeb(
    new TonWeb.HttpProvider(
      `https://${config.TESTNET ? "testnet." : ""}toncenter.com/api/v2/jsonRPC`,
      { apiKey: config.TONCENTER_API_KEY },
    ),
  );

  private static async getTransactions(
    address: Address,
    offsetTransactionLT: string | number | undefined,
    offsetTransactionHash: string | undefined,
  ) {
    const limit = 100;
    try {
      return await this.client.provider.getTransactions(
        address.toString(),
        limit,
        offsetTransactionLT,
        offsetTransactionHash,
      );
    } catch (error) {
      logger.error(error);
      return [];
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static async processTrx(tx: any) {
    if (tx.in_msg.source && tx.out_msgs.length === 0) {
      const { utime } = tx;
      const { value, source } = tx.in_msg;
      const { lt, hash } = tx.transaction_id;

      const trxModel = new TransactionModel();
      trxModel.utime = utime;
      trxModel.lt = lt;
      trxModel.address = source;
      trxModel.coins = value;
      trxModel.hash = hash;
      await trxModel.save();

      const user = await findUserByAddress(source);
      if (user) {
        // amount in nano-Toncoins (1 Toncoin = 1e9 nano-Toncoins)
        const ton = Number(fromNano(value));
        const points = Math.round(ton * 100_000);
        logger.info(`${ton} => ${points}`);
        user.votes += points;
        await user.save();
      } else {
        logger.error(`USER WITH ADDRESS ${source} NOT FOUND`);
      }
    }
  }

  static async start() {
    let isProcessing = false;

    const tick = async () => {
      if (isProcessing) return;
      isProcessing = true;

      try {
        const latestTrx = await getLastestTransaction();
        const address = Address.parse(config.COLLECTION_ADDRESS);
        const trxs = await BlockchainSubscription.getTransactions(
          address,
          latestTrx?.lt,
          latestTrx?.hash,
        );
        // eslint-disable-next-line no-restricted-syntax
        for (const trx of trxs) {
          if (trx.utime > (latestTrx?.utime ?? 0)) {
            this.processTrx(trx);
          }
        }
      } catch (error) {
        logger.error(error);
      }

      isProcessing = false;
    };

    setInterval(tick, 20 * 1000);
    tick();
  }
}
