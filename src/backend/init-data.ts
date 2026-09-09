import process from 'node:process'
import { isExpiredError, parse, validate } from '@telegram-apps/init-data-node'
import { ClientError } from '#root/common/errors'

const INIT_DATA_EXPIRES_IN_SECONDS = 60 * 60 * 24

export const SESSION_EXPIRED_MESSAGE = 'Session expired — close and reopen the app'

export function defaultValidateInitData(initData: string): void {
  const botToken = process.env.BOT_TOKEN
  if (!botToken) {
    throw new Error('BOT_TOKEN is not configured')
  }
  try {
    validate(initData, botToken, { expiresIn: INIT_DATA_EXPIRES_IN_SECONDS })
  } catch (err) {
    // initData is a snapshot taken at Mini App launch and is never refreshed
    // by the client, so a session left open long enough always ages out. That
    // is a user-actionable state, not an internal failure — don't let
    // safeErrorResponse flatten it into "Unable to process request".
    if (isExpiredError(err)) {
      throw new ClientError(SESSION_EXPIRED_MESSAGE)
    }
    throw err
  }
}

export const defaultParseInitData = parse
