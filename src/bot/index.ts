import { queueMenu } from "#root/bot/keyboards/queue-menu.js";
import { autoChatAction } from "@grammyjs/auto-chat-action";
import { hydrate } from "@grammyjs/hydrate";
import { hydrateReply, parseMode } from "@grammyjs/parse-mode";
import { BotConfig, StorageAdapter, Bot as TelegramBot, session } from "grammy";
import { autoRetry } from "@grammyjs/auto-retry";
import {
  Context,
  SessionData,
  createContextConstructor,
} from "#root/bot/context.js";
import {
  adminFeature,
  languageFeature,
  unhandledFeature,
  resetFeature,
  mintFeature,
  startFeature,
  diceFeature,
  queueFeature,
  collectionFeature,
  topupFeature,
  promptsFeature,
  strengthFeature,
  whalesFeature,
  lineFeature,
  transactionFeature,
} from "#root/bot/features/index.js";
import { errorHandler } from "#root/bot/handlers/index.js";
import { i18n, isMultipleLocales } from "#root/bot/i18n.js";
import { updateLogger } from "#root/bot/middlewares/index.js";
import { config } from "#root/config.js";
import { logger } from "#root/logger.js";
import attachUser from "#root/bot/middlewares/attach-user.js";
import slapReaction from "./middlewares/reaction";

type Options = {
  sessionStorage?: StorageAdapter<SessionData>;
  config?: Omit<BotConfig<Context>, "ContextConstructor">;
};

export function createBot(token: string, options: Options) {
  const { sessionStorage } = options;
  const bot = new TelegramBot(token, {
    ...options.config,
    ContextConstructor: createContextConstructor({ logger }),
  });
  const protectedBot = bot.errorBoundary(errorHandler);

  // Middlewares
  bot.api.config.use(parseMode("HTML"));
  bot.api.config.use(autoRetry());

  if (config.isDev) {
    protectedBot.use(updateLogger());
  }

  protectedBot.use(autoChatAction(bot.api));
  protectedBot.use(hydrateReply);
  protectedBot.use(hydrate());
  protectedBot.use(
    session({
      initial: () => ({}),
      storage: sessionStorage,
    }),
  );
  protectedBot.use(slapReaction);
  protectedBot.use(i18n);
  protectedBot.use(attachUser);
  protectedBot.use(queueMenu);

  // Handlers
  protectedBot.use(startFeature);
  protectedBot.use(resetFeature);
  protectedBot.use(mintFeature);
  protectedBot.use(diceFeature);
  protectedBot.use(queueFeature);
  protectedBot.use(promptsFeature);
  protectedBot.use(strengthFeature);
  protectedBot.use(collectionFeature);
  protectedBot.use(topupFeature);
  protectedBot.use(adminFeature);
  protectedBot.use(whalesFeature);
  protectedBot.use(lineFeature);
  protectedBot.use(transactionFeature);

  if (isMultipleLocales) {
    protectedBot.use(languageFeature);
  }

  // must be the last handler
  protectedBot.use(unhandledFeature);

  return bot;
}

export type Bot = ReturnType<typeof createBot>;
