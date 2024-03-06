import { modelOptions, prop, getModelForClass } from "@typegoose/typegoose";

/**
{
      "@type": "raw.transaction",
      "address": {
        "@type": "accountAddress",
        "account_address": "EQC4sEG_VQ4QawHnr77mqJhC98cpoyI-0gXuwR76Ff2kT2HH"
      },
      "utime": 1709383235,
      "data": "te6cckECBwEAAbgAA7V7iwQb9VDhBrAeevvuaomEL3xymjIj7SBe7BHvoV/aRPAAARy2vxKMTHeJaWWz8gBBaS5dAJx9Bq10H5e1zInh5O4mDF+QXMzQAAEctPv8CBZeMeQwABRh5BCoAQIDAQGgBACCcvtBpuONX+sxfYCXvK0YC3lZq6ZX6vU8WGJGlp2Lk6z9GkLDOPcoZIABUWoNgoVnX5j8TVwhEg693/fzmwgQy2wCGwyAW0lASoF8gBhh4+MRBQYA90gBJCJaJssVOKyQUQXQkN+RGCUcOXtCYTEVqc1NoQTm+P0ALiwQb9VDhBrAeevvuaomEL3xymjIj7SBe7BHvoV/aRPUBKgXyAAGFFhgAAAjltfiUYbLxjyGAAAAADQ6Ojg5nReXuhc2spe6Mrm6M7S7Mrkvuje3L7E3ukAAnkB77D0JAAAAAAAAAAAAHQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAW8AAAAAAAAAAAAAAAAEtRS2kSeULjPfdJ4YfFGEir+G1RruLcPyCFvDGFBOfjgSEApdZ",
      "transaction_id": {
        "@type": "internal.transactionId",
        "lt": "19565387000004",
        "hash": "AAPgP7pdTTvLgdA+OrsNB0zCnX2Unhkc8dN6dKV/q38="
      },
      "fee": "991365",
      "storage_fee": "365",
      "other_fee": "991000",
      "in_msg": {
        "@type": "raw.message",
        "source": "EQCSES0TZYqcVkgoguhIb8iMEo4cvaEwmIrU5qbQgnN8fmvP",
        "destination": "EQC4sEG_VQ4QawHnr77mqJhC98cpoyI-0gXuwR76Ff2kT2HH",
        "value": "5000000000",
        "fwd_fee": "666672",
        "ihr_fee": "0",
        "created_lt": "19565387000003",
        "body_hash": "CMMIRQMWLHXJjH1x5SzZUOdTkBKcBkGwThU2UacDJt4=",
        "msg_data": {
          "@type": "msg.dataText",
          "text": "aHR0cHM6Ly90Lm1lL3Rlc3RnaXZlcl90b25fYm90"
        },
        "message": "https://t.me/testgiver_ton_bot"
      },
      "out_msgs": []
    }
 */

@modelOptions({
  schemaOptions: { timestamps: false },
  options: { customName: "tx" },
})
export class Transaction {
  @prop({ type: Number, required: true, index: true })
  utime!: number;

  @prop({ type: Number, required: true })
  lt!: number;

  @prop({ type: String, required: true })
  address!: string;

  @prop({ type: Number, required: true })
  coins!: number;

  @prop({ type: String, required: true })
  hash!: string;
}

export const TransactionModel = getModelForClass(Transaction);

export async function getLastestTransaction() {
  return TransactionModel.findOne().sort({ utime: -1 });
}
