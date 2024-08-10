import { NextFunction } from "grammy"
import { Context } from "#root/bot/context"

export default async function slapReaction(ctx: Context, next: NextFunction) {
  if (!ctx.from && ctx.channelPost) {
    const channelUsername = ctx.channelPost.chat.username ?? ""
    if (["cube_worlds", "cube_worlds_ru"].includes(channelUsername)) {
      return ctx.channelPost.react("🔥")
    }
    return
  }
  return next()
}
