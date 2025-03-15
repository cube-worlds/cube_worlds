import type { Context } from '#root/bot/context.js'
import type { BotCommand, LanguageCode } from '@grammyjs/types'
import type { CommandContext } from 'grammy'
import { i18n, isMultipleLocales } from '#root/bot/i18n.js'
import { config } from '#root/config.js'

function getLanguageCommand(localeCode: string): BotCommand {
  return {
    command: 'language',
    description: i18n.t(localeCode, 'language_command.description'),
  }
}

function getPrivateChatCommands(localeCode: string): BotCommand[] {
  return [
    {
      command: 'start',
      description: i18n.t(localeCode, 'start_command.description'),
    },
    {
      command: 'mint',
      description: i18n.t(localeCode, 'mint_command.description'),
    },
    {
      command: 'play',
      description: i18n.t(localeCode, 'play_command.description'),
    },
    {
      command: 'line',
      description: i18n.t(localeCode, 'line_command.description'),
    },
    {
      command: 'dice',
      description: i18n.t(localeCode, 'dice_command.description'),
    },
    {
      command: 'whales',
      description: i18n.t(localeCode, 'whales_command.description'),
    },
  ]
}

function getPrivateChatAdminCommands(localeCode: string): BotCommand[] {
  return [
    {
      command: 'queue',
      description: '🔥 Show queue',
    },
    {
      command: 'description',
      description: '🏞️ Custom description',
    },
    {
      command: 'user',
      description: '🙍🏻‍♂️ Info about user',
    },
    {
      command: 'positive',
      description: '👍 Positive prompt',
    },
    {
      command: 'negative',
      description: '👎 Negative prompt',
    },
    {
      command: 'strength',
      description: '💪 Strength for images',
    },
    {
      command: 'scale',
      description: '⚖️ Scale for images',
    },
    {
      command: 'steps',
      description: '🦶 Steps for images',
    },
    {
      command: 'preset',
      description: '🎛️ Preset for images',
    },
    {
      command: 'sampler',
      description: '🎚️ Sampler for images',
    },
    {
      command: 'setcommands',
      description: i18n.t(localeCode, 'setcommands_command.description'),
    },
  ]
}

function getGroupChatCommands(_localeCode: string): BotCommand[] {
  return []
}

export async function setCommandsHandler(ctx: CommandContext<Context>) {
  const DEFAULT_LANGUAGE_CODE = 'en'

  // set private chat commands
  await ctx.api.setMyCommands(
    [
      ...getPrivateChatCommands(DEFAULT_LANGUAGE_CODE),
      ...(isMultipleLocales ? [getLanguageCommand(DEFAULT_LANGUAGE_CODE)] : []),
    ],
    {
      scope: {
        type: 'all_private_chats',
      },
    },
  )

  if (isMultipleLocales) {
    const requests = i18n.locales.map(code =>
      ctx.api.setMyCommands(
        [
          ...getPrivateChatCommands(code),
          ...(isMultipleLocales ? [getLanguageCommand(DEFAULT_LANGUAGE_CODE)] : []),
        ],
        {
          language_code: code as LanguageCode,
          scope: {
            type: 'all_private_chats',
          },
        },
      ),
    )

    await Promise.all(requests)
  }

  // set group chat commands
  await ctx.api.setMyCommands(getGroupChatCommands(DEFAULT_LANGUAGE_CODE), {
    scope: {
      type: 'all_group_chats',
    },
  })

  if (isMultipleLocales) {
    const requests = i18n.locales.map(code =>
      ctx.api.setMyCommands(getGroupChatCommands(code), {
        language_code: code as LanguageCode,
        scope: {
          type: 'all_group_chats',
        },
      }),
    )
    // const nameRequests = i18n.locales.map((code) =>
    //   ctx.api.setMyName("$CUBE Worlds", { language_code: code }),
    // );

    // when the chat is empty
    const descriptionRequests = i18n.locales.map(code =>
      ctx.api.setMyDescription(i18n.t(code, 'bot.description'), {
        language_code: code as LanguageCode,
      }),
    )

    // bot's profile page and in share links
    const shortDescriptionRequests = i18n.locales.map(code =>
      ctx.api.setMyShortDescription(i18n.t(code, 'bot.short_description'), {
        language_code: code as LanguageCode,
      }),
    )
    await Promise.all([...requests, ...descriptionRequests, ...shortDescriptionRequests])
  }

  // set private chat commands for owner

  for (const adminId of config.BOT_ADMINS) {
    await ctx.api.setMyCommands(
      [
        ...getPrivateChatCommands(DEFAULT_LANGUAGE_CODE),
        ...getPrivateChatAdminCommands(DEFAULT_LANGUAGE_CODE),
        ...(isMultipleLocales ? [getLanguageCommand(DEFAULT_LANGUAGE_CODE)] : []),
      ],
      {
        scope: {
          type: 'chat',
          chat_id: adminId,
        },
      },
    )
  }

  return ctx.reply(ctx.t('admin.commands-updated'))
}
