import {
  buildSetMenuButton,
  buildSyncBotCommands,
} from '#root/bot/handlers/commands/sync-commands-core'
import { i18n } from '#root/common/i18n'
import { config } from '#root/config'

const DEFAULT_LOCALE = 'en'

export const syncBotCommands = buildSyncBotCommands({
  botAdmins: config.BOT_ADMINS,
  locales: i18n.locales,
  defaultLocale: DEFAULT_LOCALE,
  translate: (locale, key) => i18n.t(locale, key),
})

export const setMenuButton = buildSetMenuButton({
  webAppUrl: config.WEB_APP_URL,
  label: i18n.t(DEFAULT_LOCALE, 'menu_button.label'),
})

export type { BotApiLike } from '#root/bot/handlers/commands/sync-commands-core'
