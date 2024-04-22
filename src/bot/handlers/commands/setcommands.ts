import { BotCommand } from "@grammyjs/types";
import { CommandContext } from "grammy";
import { i18n, isMultipleLocales } from "#root/bot/i18n.js";
import { config } from "#root/config.js";
import type { Context } from "#root/bot/context.js";

function getLanguageCommand(localeCode: string): BotCommand {
  return {
    command: "language",
    description: i18n.t(localeCode, "language_command.description"),
  };
}

function getPrivateChatCommands(localeCode: string): BotCommand[] {
  return [
    {
      command: "start",
      description: i18n.t(localeCode, "start_command.description"),
    },
    {
      command: "mint",
      description: i18n.t(localeCode, "mint_command.description"),
    },
    {
      command: "line",
      description: i18n.t(localeCode, "line_command.description"),
    },
    {
      command: "dice",
      description: i18n.t(localeCode, "dice_command.description"),
    },
    {
      command: "whales",
      description: i18n.t(localeCode, "whales_command.description"),
    },
  ];
}

function getPrivateChatAdminCommands(localeCode: string): BotCommand[] {
  return [
    {
      command: "queue",
      description: "🔥 Show queue",
    },
    {
      command: "description",
      description: "🏞️ Custom description",
    },
    {
      command: "positive",
      description: "👍 Positive prompt",
    },
    {
      command: "negative",
      description: "👎 Negative prompt",
    },
    {
      command: "strength",
      description: "💪 Strength for images",
    },
    {
      command: "scale",
      description: "⚖️ Scale for images",
    },
    {
      command: "steps",
      description: "🦶 Steps for images",
    },
    {
      command: "preset",
      description: "🎛️ Preset for images",
    },
    {
      command: "sampler",
      description: "🎚️ Sampler for images",
    },
    {
      command: "setcommands",
      description: i18n.t(localeCode, "setcommands_command.description"),
    },
  ];
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function getGroupChatCommands(localeCode: string): BotCommand[] {
  return [];
}

export async function setCommandsHandler(ctx: CommandContext<Context>) {
  const DEFAULT_LANGUAGE_CODE = "en";

  // set private chat commands
  await ctx.api.setMyCommands(
    [
      ...getPrivateChatCommands(DEFAULT_LANGUAGE_CODE),
      ...(isMultipleLocales ? [getLanguageCommand(DEFAULT_LANGUAGE_CODE)] : []),
    ],
    {
      scope: {
        type: "all_private_chats",
      },
    },
  );

  if (isMultipleLocales) {
    const requests = i18n.locales.map((code) =>
      ctx.api.setMyCommands(
        [
          ...getPrivateChatCommands(code),
          ...(isMultipleLocales
            ? [getLanguageCommand(DEFAULT_LANGUAGE_CODE)]
            : []),
        ],
        {
          language_code: code,
          scope: {
            type: "all_private_chats",
          },
        },
      ),
    );

    await Promise.all(requests);
  }

  // set group chat commands
  await ctx.api.setMyCommands(getGroupChatCommands(DEFAULT_LANGUAGE_CODE), {
    scope: {
      type: "all_group_chats",
    },
  });

  if (isMultipleLocales) {
    const requests = i18n.locales.map((code) =>
      // TODO: set https://core.telegram.org/bots/api#setmydescription
      // and https://core.telegram.org/bots/api#setmyshortdescription
      ctx.api.setMyCommands(getGroupChatCommands(code), {
        language_code: code,
        scope: {
          type: "all_group_chats",
        },
      }),
    );

    await Promise.all(requests);
  }

  // set private chat commands for owner
  // eslint-disable-next-line no-restricted-syntax
  for (const adminId of config.BOT_ADMINS) {
    // eslint-disable-next-line no-await-in-loop
    await ctx.api.setMyCommands(
      [
        ...getPrivateChatCommands(DEFAULT_LANGUAGE_CODE),
        ...getPrivateChatAdminCommands(DEFAULT_LANGUAGE_CODE),
        ...(isMultipleLocales
          ? [getLanguageCommand(DEFAULT_LANGUAGE_CODE)]
          : []),
      ],
      {
        scope: {
          type: "chat",
          chat_id: adminId,
        },
      },
    );
  }

  return ctx.reply(ctx.t("admin.commands-updated"));
}
