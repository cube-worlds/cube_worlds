/* eslint-disable test/no-import-node-test */
import type { Context } from '#root/bot/context'
import type { AttachUserDependencies } from '#root/bot/middlewares/attach-user'
import type { UserDoc } from '#root/common/models/User'
import type { InlineKeyboard, NextFunction } from 'grammy'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildAttachUser } from '#root/bot/middlewares/attach-user'

interface UserStub {
  id: number
  language?: string
  languageSelected?: boolean
  saveCalls: number
  save: () => Promise<void>
}

function makeUser(overrides: Partial<UserStub> = {}): UserStub {
  const stub: UserStub = {
    id: 7,
    language: undefined,
    languageSelected: undefined,
    saveCalls: 0,
    save: async () => { stub.saveCalls += 1 },
    ...overrides,
  }
  return stub
}

interface CtxStub {
  from?: { id: number }
  dbuser?: UserStub
  i18n: {
    getLocale: () => Promise<string>
    setLocale: (locale: string) => Promise<void>
    setLocaleCalls: string[]
  }
  t: (key: string) => string
  reply: (text: string, options: { reply_markup: InlineKeyboard }) => Promise<void>
  replyCalls: { text: string, replyMarkup: InlineKeyboard }[]
}

function makeCtx(overrides: { from?: { id: number }, locale?: string } = {}): CtxStub {
  const setLocaleCalls: string[] = []
  const replyCalls: { text: string, replyMarkup: InlineKeyboard }[] = []
  return {
    from: overrides.from ?? { id: 7 },
    i18n: {
      getLocale: async () => overrides.locale ?? 'en',
      setLocale: async (locale) => { setLocaleCalls.push(locale) },
      setLocaleCalls,
    },
    t: (key) => `t(${key})`,
    reply: async (text, options) => { replyCalls.push({ text, replyMarkup: options.reply_markup }) },
    replyCalls,
  }
}

async function run(deps: AttachUserDependencies, ctx: CtxStub) {
  let nextCalls = 0
  const next: NextFunction = async () => { nextCalls += 1 }
  const middleware = buildAttachUser(deps)
  await middleware(ctx as unknown as Context, next)
  return { nextCalls }
}

test('attachUser throws "No from field found" when ctx.from is missing', async () => {
  const ctx = makeCtx()
  ctx.from = undefined

  await assert.rejects(
    () => run(
      {
        findOrCreateUser: async () => makeUser() as unknown as UserDoc,
        supportedLocales: ['en'],
        createKeyboard: () => ({} as InlineKeyboard),
      },
      ctx,
    ),
    /No from field found/,
  )
})

test('attachUser throws "User not found" when findOrCreateUser returns null', async () => {
  const ctx = makeCtx({ from: { id: 7 } })

  await assert.rejects(
    () => run(
      {
        findOrCreateUser: async () => null,
        supportedLocales: ['en'],
        createKeyboard: () => ({} as InlineKeyboard),
      },
      ctx,
    ),
    /User not found/,
  )
})

test('attachUser persists default-en when locale is unsupported and replies with keyboard', async () => {
  const ctx = makeCtx({ from: { id: 7 }, locale: 'jp' })
  const user = makeUser()
  const keyboard = {} as InlineKeyboard
  const keyboardCalls: Context[] = []

  const { nextCalls } = await run(
    {
      findOrCreateUser: async () => user as unknown as UserDoc,
      supportedLocales: ['en', 'ru'],
      createKeyboard: (c) => {
        keyboardCalls.push(c)
        return keyboard
      },
    },
    ctx,
  )

  assert.equal(nextCalls, 1)
  assert.equal(user.language, 'en')
  assert.equal(user.languageSelected, true)
  assert.equal(user.saveCalls, 1)
  // Unsupported locale → reply with the language-select keyboard
  assert.equal(ctx.replyCalls.length, 1)
  assert.equal(ctx.replyCalls[0].text, 't(language.select)')
  assert.equal(ctx.replyCalls[0].replyMarkup, keyboard)
  assert.equal(keyboardCalls.length, 1)
  // Final i18n locale is the one we just chose for the user
  assert.deepEqual(ctx.i18n.setLocaleCalls, ['en'])
})

test('attachUser accepts a supported locale without replying with the keyboard', async () => {
  const ctx = makeCtx({ from: { id: 7 }, locale: 'ru' })
  const user = makeUser()
  let createKeyboardCalls = 0

  await run(
    {
      findOrCreateUser: async () => user as unknown as UserDoc,
      supportedLocales: ['en', 'ru'],
      createKeyboard: () => {
        createKeyboardCalls += 1
        return ({} as InlineKeyboard)
      },
    },
    ctx,
  )

  assert.equal(user.language, 'ru')
  assert.equal(user.languageSelected, true)
  assert.equal(user.saveCalls, 1)
  assert.equal(ctx.replyCalls.length, 0)
  assert.equal(createKeyboardCalls, 0)
  assert.deepEqual(ctx.i18n.setLocaleCalls, ['ru'])
})

test('attachUser skips locale selection when user already has a language set', async () => {
  const ctx = makeCtx({ from: { id: 7 } })
  const user = makeUser({ language: 'ru', languageSelected: true })

  await run(
    {
      findOrCreateUser: async () => user as unknown as UserDoc,
      supportedLocales: ['en', 'ru'],
      createKeyboard: () => ({} as InlineKeyboard),
    },
    ctx,
  )

  // No save (since the locale block was skipped)
  assert.equal(user.saveCalls, 0)
  assert.equal(ctx.replyCalls.length, 0)
  // setLocale still fires with the persisted language
  assert.deepEqual(ctx.i18n.setLocaleCalls, ['ru'])
})

test('attachUser attaches the resolved user onto ctx.dbuser', async () => {
  const ctx = makeCtx({ from: { id: 7 } })
  const user = makeUser({ id: 42, language: 'en', languageSelected: true })

  await run(
    {
      findOrCreateUser: async () => user as unknown as UserDoc,
      supportedLocales: ['en'],
      createKeyboard: () => ({} as InlineKeyboard),
    },
    ctx,
  )

  assert.equal(ctx.dbuser, user as unknown as UserStub)
})
