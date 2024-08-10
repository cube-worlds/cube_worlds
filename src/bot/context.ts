import { Update, UserFromGetMe } from "@grammyjs/types"
import { Context as DefaultContext, SessionFlavor, type Api } from "grammy"
import type { AutoChatActionFlavor } from "@grammyjs/auto-chat-action"
import type { HydrateFlavor } from "@grammyjs/hydrate"
import type { I18nFlavor } from "@grammyjs/i18n"
import type { ParseModeFlavor } from "@grammyjs/parse-mode"
import type { Logger } from "#root/logger.js"
import { User } from "#root/bot/models/user.js"
import { DocumentType } from "@typegoose/typegoose"

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export type SessionData = {
  // field?: string
}

type ExtendedContextFlavor = {
  dbuser: DocumentType<User>
  logger: Logger
}

export type Context = ParseModeFlavor<
  HydrateFlavor<
    DefaultContext &
      ExtendedContextFlavor &
      SessionFlavor<SessionData> &
      I18nFlavor &
      AutoChatActionFlavor
  >
>

interface Dependencies {
  dbuser?: DocumentType<User>
  logger: Logger
}

export function createContextConstructor({ logger }: Dependencies) {
  return class extends DefaultContext implements ExtendedContextFlavor {
    dbuser!: DocumentType<User>

    logger: Logger

    constructor(update: Update, api: Api, me: UserFromGetMe) {
      super(update, api, me)

      this.logger = logger.child({
        update_id: this.update.update_id,
      })
    }
  } as unknown as new (update: Update, api: Api, me: UserFromGetMe) => Context
}
