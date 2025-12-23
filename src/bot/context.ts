import type { User } from '#root/common/models/User'
import type { Logger } from '#root/logger'
import type { AutoChatActionFlavor } from '@grammyjs/auto-chat-action'
import type { HydrateFlavor } from '@grammyjs/hydrate'
import type { I18nFlavor } from '@grammyjs/i18n'
import type { Update, UserFromGetMe } from '@grammyjs/types'
import type { DocumentType } from '@typegoose/typegoose'
import type { Api, SessionFlavor } from 'grammy'
import { Context as DefaultContext } from 'grammy'

export interface SessionData {
  // field?: string
}

interface ExtendedContextFlavor {
  dbuser: DocumentType<User>
  logger: Logger
}

export type Context = HydrateFlavor<
  DefaultContext &
    ExtendedContextFlavor &
    SessionFlavor<SessionData> &
    I18nFlavor &
    AutoChatActionFlavor
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
