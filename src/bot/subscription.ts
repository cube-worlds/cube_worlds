import { i18n } from "#root/bot/i18n.js";
/* eslint-disable class-methods-use-this */
import { logger } from "#root/logger";
import { Address, fromNano } from "@ton/core";
import { config } from "#root/config";
import TonWeb from "tonweb";
import { Api, Bot, RawApi } from "grammy";
import { TransactionModel, getLastestTransaction } from "./models/transaction";
import { findUserByAddress, placeInLine } from "./models/user";
import { Context } from "./context";

export class Subscription {
  bot: Bot<Context, Api<RawApi>>;

  client: TonWeb;

  constructor(bot: Bot<Context, Api<RawApi>>) {
    this.bot = bot;
    this.client = new TonWeb(
      new TonWeb.HttpProvider(
        `https://${config.TESTNET ? "testnet." : ""}toncenter.com/api/v2/jsonRPC`,
        { apiKey: config.TONCENTER_API_KEY },
      ),
    );
  }

  private async getTransactions(
    address: Address,
    offsetTransactionLT: number | undefined,
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
  private async processTrx(tx: any) {
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
        const ton = fromNano(value);
        const points = Math.round(Number(ton) * 100_000);
        logger.info(`${ton} => ${points}`);
        user.votes += points;
        await user.save();

        await this.bot.api.sendMessage(
          user.id,
          i18n.t(user.language, "bet", { ton }),
        );

        const place = await placeInLine(user.votes);
        this.bot.api.sendMessage(
          user.id,
          i18n.t(user.language, "speedup", {
            place,
            inviteLink: `https://t.me/${this.bot.botInfo.username}?start=${user.id}`,
            collectionAddress: config.COLLECTION_ADDRESS,
          }),
        );
      } else {
        logger.error(`USER WITH ADDRESS ${source} NOT FOUND`);
      }
    }
  }

  async start() {
    let isProcessing = false;

    const tick = async () => {
      if (isProcessing) return;
      isProcessing = true;

      try {
        const latestTx = await getLastestTransaction();
        logger.info(`Latest tx: ${latestTx?.lt}:${latestTx?.hash}`);
        const address = Address.parse(config.COLLECTION_ADDRESS);
        const txs = await this.getTransactions(
          address,
          latestTx?.lt,
          latestTx?.hash,
        );
        // eslint-disable-next-line no-restricted-syntax
        for (const tx of txs) {
          if (tx.utime > (latestTx?.utime ?? 0)) {
            this.processTrx(tx);
          }
        }
      } catch (error) {
        logger.error(error);
      }

      isProcessing = false;
    };

    setInterval(tick, 30 * 1000);
    tick();
  }
}
