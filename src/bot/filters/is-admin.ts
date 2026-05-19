import { isUserHasId } from 'grammy-guard'
import { config } from '#root/config'

export const isAdmin = isUserHasId(...config.BOT_ADMINS)
