import { NextFunction } from "grammy";
import { findOrCreateUser } from "#root/bot/models/user.js";
import { Context } from "#root/bot/context.js";
import { i18n } from "../i18n";
import { sendMessageToAdmins } from "../helpers/telegram";

export default async function attachUser(ctx: Context, next: NextFunction) {
  if (!ctx.from) {
    throw new Error("No from field found");
  }
  const user = await findOrCreateUser(ctx.from.id);
  if (!user) {
    throw new Error("User not found");
  }
  ctx.dbuser = user;
  if (!ctx.dbuser.languageSelected) {
    const locale = await ctx.i18n.getLocale();
    const localeSupported = i18n.locales.includes(locale);
    if (!localeSupported) {
      sendMessageToAdmins(ctx.api, `🔠 Unsupported locale: ${locale}`);
    }
    ctx.dbuser.language = localeSupported ? locale : "en";
    ctx.dbuser.languageSelected = true;
    await ctx.dbuser.save();
  }
  await ctx.i18n.setLocale(ctx.dbuser.language);
  return next();
}
