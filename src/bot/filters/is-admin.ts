import { config } from '#root/config.js'
import { isUserHasId } from 'grammy-guard'

export const isAdmin = isUserHasId(...config.BOT_ADMINS)
