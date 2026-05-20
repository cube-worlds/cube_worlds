import process from 'node:process'
import { parse, validate } from '@telegram-apps/init-data-node'

const INIT_DATA_EXPIRES_IN_SECONDS = 60 * 60 * 24

export function defaultValidateInitData(initData: string): void {
  const botToken = process.env.BOT_TOKEN
  if (!botToken) {
    throw new Error('BOT_TOKEN is not configured')
  }
  validate(initData, botToken, { expiresIn: INIT_DATA_EXPIRES_IN_SECONDS })
}

export const defaultParseInitData = parse
