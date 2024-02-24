// import { config } from "#root/config.js";
import { ISession } from "@grammyjs/storage-mongodb";
import mongoose from "mongoose";

export async function vote(userId: string, add: number) {
  const collection = mongoose.connection.db.collection<ISession>("users");
  return collection.updateOne({ key: userId }, { $inc: { votes: add } });
}
