import { NextFunction } from "grammy";
import { findOrCreateUser } from "#root/bot/models/user.js";
import { Context } from "#root/bot/context.js";
import { i18n } from "../i18n";
import { createChangeLanguageKeyboard } from "../keyboards/change-language";

export default async function attachUser(ctx: Context, next: NextFunction) {
  if (!ctx.from) {
    throw new Error("No from field found");
  }
  if (
    [
      357_112_219, 984_008_925, 438_206_989, 1_322_821_423, 207_708_676,
      1_590_560_881, 1_077_297_150, 5_249_970_828, 766_177_676, 1_043_654_658,
      459_700_709, 6_586_100_143, 173_161_322, 1_102_379_017, 1_204_674_486,
      6_513_805_506, 398_931_096, 6_304_453_507, 466_149_710, 1_498_235_504,
      1_475_010_584, 921_751_858, 989_893_091,
    ].includes(ctx.from.id)
  ) {
    return;
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
      await ctx.reply(ctx.t("language.select"), {
        reply_markup: createChangeLanguageKeyboard(ctx),
      });
      // await sendMessageToAdmins(
      //   ctx.api,
      //   `🔠 Unsupported locale: ${locale} from @${ctx.from.username}`,
      // );
    }
    ctx.dbuser.language = localeSupported ? locale : "en";
    ctx.dbuser.languageSelected = true;
    await ctx.dbuser.save();
  }
  await ctx.i18n.setLocale(ctx.dbuser.language);
  return next();
}
