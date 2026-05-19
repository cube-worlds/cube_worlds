import type { BotCommand, LanguageCode } from '@grammyjs/types'

export interface BotApiLike {
  setMyCommands: (
    commands: BotCommand[],
    options?: { language_code?: LanguageCode, scope?: { type: string, chat_id?: number } },
  ) => Promise<unknown>
  setMyDescription: (
    description: string,
    options?: { language_code?: LanguageCode },
  ) => Promise<unknown>
  setMyShortDescription: (
    short_description: string,
    options?: { language_code?: LanguageCode },
  ) => Promise<unknown>
  setChatMenuButton: (options: { menu_button: unknown }) => Promise<unknown>
}

export type TranslateFn = (locale: string, key: string) => string

export interface SyncCommandsDependencies {
  botAdmins: number[]
  locales: readonly string[]
  defaultLocale: string
  translate: TranslateFn
}

export function buildPrivateChatCommands(locale: string, translate: TranslateFn): BotCommand[] {
  return [
    { command: 'start', description: translate(locale, 'start_command.description') },
    { command: 'help', description: translate(locale, 'help_command.description') },
    { command: 'whales', description: translate(locale, 'whales_command.description') },
  ]
}

export function buildAdminChatCommands(): BotCommand[] {
  return [
    { command: 'stats', description: '📊 Stats' },
    { command: 'queue', description: '🔥 Show queue' },
    { command: 'line', description: '⏳ Show the line' },
    { command: 'transaction', description: '💸 Transaction' },
    { command: 'collection', description: '🖼 Collection' },
    { command: 'user', description: '🙍🏻‍♂️ Info about user' },
    { command: 'positive', description: '👍 Positive prompt' },
    { command: 'negative', description: '👎 Negative prompt' },
    { command: 'strength', description: '💪 Strength for images' },
    { command: 'scale', description: '⚖️ Scale for images' },
    { command: 'steps', description: '🦶 Steps for images' },
    { command: 'preset', description: '🎛️ Preset for images' },
    { command: 'sampler', description: '🎚️ Sampler for images' },
  ]
}

export function buildSyncBotCommands(deps: SyncCommandsDependencies) {
  return async function syncBotCommands(api: BotApiLike): Promise<void> {
    await api.setMyCommands(
      buildPrivateChatCommands(deps.defaultLocale, deps.translate),
      { scope: { type: 'all_private_chats' } },
    )

    await Promise.all(
      deps.locales.map(locale =>
        api.setMyCommands(
          buildPrivateChatCommands(locale, deps.translate),
          {
            language_code: locale as LanguageCode,
            scope: { type: 'all_private_chats' },
          },
        ),
      ),
    )

    await api.setMyCommands([], { scope: { type: 'all_group_chats' } })
    await Promise.all(
      deps.locales.map(locale =>
        api.setMyCommands([], {
          language_code: locale as LanguageCode,
          scope: { type: 'all_group_chats' },
        }),
      ),
    )

    await Promise.all(
      deps.locales.map(locale =>
        api.setMyDescription(deps.translate(locale, 'bot.description'), {
          language_code: locale as LanguageCode,
        }),
      ),
    )
    await Promise.all(
      deps.locales.map(locale =>
        api.setMyShortDescription(deps.translate(locale, 'bot.short_description'), {
          language_code: locale as LanguageCode,
        }),
      ),
    )

    for (const adminId of deps.botAdmins) {
      await api.setMyCommands(
        [
          ...buildPrivateChatCommands(deps.defaultLocale, deps.translate),
          ...buildAdminChatCommands(),
        ],
        { scope: { type: 'chat', chat_id: adminId } },
      )
    }
  }
}

export interface SetMenuButtonDependencies {
  webAppUrl: string
  label: string
}

export function buildSetMenuButton(deps: SetMenuButtonDependencies) {
  return async function setMenuButton(api: Pick<BotApiLike, 'setChatMenuButton'>): Promise<void> {
    await api.setChatMenuButton({
      menu_button: {
        type: 'web_app',
        text: deps.label,
        web_app: { url: deps.webAppUrl },
      },
    })
  }
}
