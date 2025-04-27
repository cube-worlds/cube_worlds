import { config } from '#root/config'
import { isUserHasId } from 'grammy-guard'

export const isAdmin = isUserHasId(...config.BOT_ADMINS)
