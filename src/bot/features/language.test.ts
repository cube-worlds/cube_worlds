/* eslint-disable test/no-import-node-test */
import type { Context } from '#root/bot/context'
import type { InlineKeyboard } from 'grammy'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildHandleLanguageSelect } from '#root/bot/features/language'

interface UserStub {
  language?: string
  saveCalls: number
  save: () => Promise<void>
}

function makeUser(overrides: Partial<UserStub> = {}): UserStub {
  const stub: UserStub = {
    language: undefined,
    saveCalls: 0,
    save: async () => { stub.saveCalls += 1 },
    ...overrides,
  }
  return stub
}

interface CtxStub {
  callbackQuery: { data: string } | undefined
  dbuser: UserStub
  i18n: { setLocale: (locale: string) => Promise<void>, setLocaleCalls: string[] }
  t: (key: string) => string
  editMessageText: (text: string, options: { reply_markup: InlineKeyboard }) => Promise<void>
  editCalls: { text: string, replyMarkup: InlineKeyboard }[]
}

function makeCtx(overrides: {
  callbackData?: string
  dbuser?: UserStub
} = {}): CtxStub {
  const setLocaleCalls: string[] = []
  const editCalls: { text: string, replyMarkup: InlineKeyboard }[] = []
  return {
    callbackQuery: overrides.callbackData === undefined
      ? undefined
      : { data: overrides.callbackData },
    dbuser: overrides.dbuser ?? makeUser(),
    i18n: {
      setLocale: async (locale) => { setLocaleCalls.push(locale) },
      setLocaleCalls,
    },
    t: (key) => `t(${key})`,
    editMessageText: async (text, options) => {
      editCalls.push({ text, replyMarkup: options.reply_markup })
    },
    editCalls,
  }
}

test('handleLanguageSelect persists a supported locale and edits the message', async () => {
  const ctx = makeCtx({ callbackData: 'lang:ru' })
  const keyboard = {} as InlineKeyboard
  let keyboardCalls = 0
  const handler = buildHandleLanguageSelect({
    supportedLocales: ['en', 'ru'],
    unpackLanguageData: (raw) => {
      assert.equal(raw, 'lang:ru')
      return { code: 'ru' }
    },
    createKeyboard: () => { keyboardCalls += 1; return keyboard },
  })

  await handler(ctx as unknown as Context)

  assert.deepEqual(ctx.i18n.setLocaleCalls, ['ru'])
  assert.equal(ctx.dbuser.language, 'ru')
  assert.equal(ctx.dbuser.saveCalls, 1)
  assert.equal(ctx.editCalls.length, 1)
  assert.equal(ctx.editCalls[0].text, 't(language.changed)')
  assert.equal(ctx.editCalls[0].replyMarkup, keyboard)
  assert.equal(keyboardCalls, 1)
})

test('handleLanguageSelect ignores codes not in supportedLocales', async () => {
  const ctx = makeCtx({ callbackData: 'lang:jp' })
  const handler = buildHandleLanguageSelect({
    supportedLocales: ['en', 'ru'],
    unpackLanguageData: () => ({ code: 'jp' }),
    createKeyboard: () => ({} as InlineKeyboard),
  })

  await handler(ctx as unknown as Context)

  assert.deepEqual(ctx.i18n.setLocaleCalls, [])
  assert.equal(ctx.dbuser.language, undefined)
  assert.equal(ctx.dbuser.saveCalls, 0)
  assert.equal(ctx.editCalls.length, 0)
})

test('handleLanguageSelect passes an empty string to unpack when callbackQuery is missing', async () => {
  const ctx = makeCtx()
  let unpackArg: string | undefined
  const handler = buildHandleLanguageSelect({
    supportedLocales: ['en'],
    unpackLanguageData: (raw) => { unpackArg = raw; return { code: '' } },
    createKeyboard: () => ({} as InlineKeyboard),
  })

  await handler(ctx as unknown as Context)
  assert.equal(unpackArg, '')
})
