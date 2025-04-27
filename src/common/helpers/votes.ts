import type { Context } from 'grammy'

export async function voteScore(ctx: Context): Promise<number> {
    const author = await ctx.getAuthor()
    const premium = author.user.is_premium ?? false
    return premium ? 1000 : 100
}
