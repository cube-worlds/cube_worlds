import { config } from "#root/config.js";
import { logger } from "#root/logger";
import TonWeb from "tonweb";
import { Address, fromNano } from "@ton/core";
import { Bot, Api, RawApi } from "grammy";
import { findUserByAddress, placeInLine } from "#root/bot/models/user";
import { i18n } from "#root/bot/i18n";
import { Context } from "#root/bot/context";
import {
  TransactionModel,
  findTransaction,
  getLastestTransaction,
} from "#root/bot/models/transaction";
import { AccountSubscription } from "#root/bot/helpers/account-subscription";

export class Subscription {
  bot: Bot<Context, Api<RawApi>>;

  tonweb: TonWeb;

  constructor(bot: Bot<Context, Api<RawApi>>) {
    this.bot = bot;

    this.tonweb = new TonWeb(
      new TonWeb.HttpProvider(
        `https://${config.TESTNET ? "testnet." : ""}toncenter.com/api/v2/jsonRPC`,
        { apiKey: config.TONCENTER_API_KEY },
      ),
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onTransaction = async (tx: any) => {
    // It is important to check that Toncoins did not bounce back in case of an error
    if (!tx.in_msg.source || tx.out_msgs.length > 0) {
      return;
    }

    const { value, source } = tx.in_msg; // amount in nano-Toncoins (1 Toncoin = 1e9 nano-Toncoins)
    const { lt, hash } = tx.transaction_id;
    const { utime } = tx;
    const senderAddress = Address.parse(source);

    // here you find the payment in your database by UUID,
    // check that the payment has not been processed yet and the amount matches,
    // save to the database that this payment has been processed.
    const trx = await findTransaction(lt, hash);
    if (trx) {
      return logger.debug(
        `Exists ${TonWeb.utils.fromNano(value)} TON from ${senderAddress}`,
      );
    }

    const trxModel = new TransactionModel();
    trxModel.utime = utime;
    trxModel.lt = lt;
    trxModel.address = senderAddress.toString();
    trxModel.coins = value;
    trxModel.hash = hash;
    await trxModel.save();
    logger.info(
      `Receive ${TonWeb.utils.fromNano(value)} TON from ${senderAddress.toString()}"`,
    );

    const ton = fromNano(value);
    const user = await findUserByAddress(senderAddress);
    if (!user) {
      return logger.error(
        `USER NOT FOUND FOR: ${ton} TON from ${senderAddress.toString()}`,
      );
    }

    // amount in nano-Toncoins (1 Toncoin = 1e9 nano-Toncoins)
    const points = Math.round(Number(ton) * 100_000);
    logger.debug(`${ton} => ${points}`);
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
        collectionOwner: config.COLLECTION_OWNER,
      }),
    );
  };

  public async startProcessTransactions() {
    const latestTrx = await getLastestTransaction();
    const startTime = latestTrx?.utime ?? 0;
    const accountSubscription = new AccountSubscription(
      this.tonweb,
      config.COLLECTION_OWNER,
      startTime,
      this.onTransaction,
    );
    accountSubscription.start();
  }
}
