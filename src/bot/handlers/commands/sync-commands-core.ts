import type { BotCommand, BotCommandScope, LanguageCode } from '@grammyjs/types'

export interface BotApiLike {
  setMyCommands: (
    commands: BotCommand[],
    options?: { language_code?: LanguageCode, scope?: BotCommandScope },
  ) => Promise<unknown>
  setMyDescription: (
    description: string,
    options?: { language_code?: LanguageCode },
  ) => Promise<unknown>
  setMyShortDescription: (
    short_description: string,
    options?: { language_code?: LanguageCode },
  ) => Promise<unknown>
  setChatMenuButton: (options: {
    menu_button: { type: 'web_app', text: string, web_app: { url: string } }
  }) => Promise<unknown>
  getChatMenuButton: () => Promise<ChatMenuButton>
}

// The subset of Telegram's MenuButton union we need to read back. A web_app
// button carries the URL/label we compare against; the other variants (default
// button, commands) carry no URL, so any of them means "not yet pointing at us".
export type ChatMenuButton =
  | { type: 'web_app', text: string, web_app: { url: string } }
  | { type: 'default' }
  | { type: 'commands' }

export type TranslateFn = (locale: string, key: string) => string

export interface SyncCommandsDependencies {
  botAdmins: readonly number[]
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

export interface MenuButtonResult {
  /** Whether Telegram was actually updated (false = already correct). */
  changed: boolean
  /** The web_app URL before this run, or null if no web_app button was set. */
  previousUrl: string | null
  /** The desired web_app URL. */
  url: string
}

export function buildSetMenuButton(deps: SetMenuButtonDependencies) {
  return async function setMenuButton(
    api: Pick<BotApiLike, 'setChatMenuButton' | 'getChatMenuButton'>,
  ): Promise<MenuButtonResult> {
    const current = await api.getChatMenuButton()
    const previous
      = current.type === 'web_app'
        ? { url: current.web_app.url, text: current.text }
        : null

    // Only touch Telegram when the URL or label actually differs — keeps deploys
    // idempotent and lets the caller log the / → /game migration when it happens.
    if (previous && previous.url === deps.webAppUrl && previous.text === deps.label) {
      return { changed: false, previousUrl: previous.url, url: deps.webAppUrl }
    }

    await api.setChatMenuButton({
      menu_button: {
        type: 'web_app',
        text: deps.label,
        web_app: { url: deps.webAppUrl },
      },
    })
    return { changed: true, previousUrl: previous?.url ?? null, url: deps.webAppUrl }
  }
}
