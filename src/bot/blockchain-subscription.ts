/* eslint-disable no-return-await */
/* eslint-disable no-await-in-loop */
/* eslint-disable no-restricted-syntax */
/* eslint-disable no-param-reassign */
/* eslint-disable no-console */

import { logger } from "#root/logger";
import {
  Address,
  CommonMessageInfoInternal,
  Transaction,
  fromNano,
} from "@ton/core";
import { config } from "#root/config";
import { tonClient } from "./helpers/ton";
import { TransactionModel, getLastestLt } from "./models/transaction";
import { findUserByAddress } from "./models/user";

export class BlockchainSubscription {
  // TON transaction has composite ID: account address (on which the transaction took place) + transaction LT (logical time) + transaction hash.
  // So TxID = address+LT+hash, these three parameters uniquely identify the transaction.
  // In our case, we are monitoring one wallet and the address is `accountAddress`.
  private static async getTransactions(
    address: Address,
    lt: string,
  ): Promise<Transaction[]> {
    const COUNT = 100;

    try {
      return await tonClient.getTransactions(address, {
        limit: COUNT,
        lt,
      });
    } catch (error) {
      logger.error(error);
      return [];
    }
  }

  static async processTrx(trx: Transaction) {
    if (trx.inMessage && trx.outMessagesCount === 0) {
      const inMessage = trx.inMessage.info as CommonMessageInfoInternal;
      if (inMessage.bounced) {
        return;
      }

      const address = inMessage.src; // dest
      const trxModel = new TransactionModel();
      trxModel.lt = trx.lt;
      trxModel.address = address.toString();
      trxModel.coins = inMessage.value.coins;
      trxModel.hash = trx.hash();
      await trxModel.save();

      const user = await findUserByAddress(address);
      if (user) {
        const ton = Number(fromNano(inMessage.value.coins));
        const points = Math.round(ton * 100_000);
        logger.info(`${ton} => ${points}`);
        user.votes += points;
        await user.save();
      } else {
        logger.error(`USER WITH ADDRESS ${address} NOT FOUND`);
      }
    }
  }

  static async start() {
    let isProcessing = false;

    const tick = async () => {
      if (isProcessing) return;
      isProcessing = true;

      try {
        const latestLt = await getLastestLt();
        const address = Address.parse(config.COLLECTION_ADDRESS);
        const trxs = await BlockchainSubscription.getTransactions(
          address,
          `${latestLt + BigInt(1)}`,
        );
        for (const trx of trxs) {
          this.processTrx(trx);
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
