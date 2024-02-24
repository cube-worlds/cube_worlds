import { NextFunction } from "grammy";
import { findOrCreateUser } from "#root/bot/models/user.js";
import { Context } from "#root/bot/context.js";

export default async function attachUser(ctx: Context, next: NextFunction) {
  if (!ctx.from) {
    throw new Error("No from field found");
  }
  const user = await findOrCreateUser(ctx.from.id);
  if (!user) {
    throw new Error("User not found");
  }
  ctx.dbuser = user;
  return next();
}
