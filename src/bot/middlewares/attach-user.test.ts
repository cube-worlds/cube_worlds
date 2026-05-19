/* eslint-disable test/no-import-node-test */
import type { Context } from '#root/bot/context'
import type { AttachUserDependencies } from '#root/bot/middlewares/attach-user'
import type { UserDoc } from '#root/common/models/User'
import type { NextFunction } from 'grammy'
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
  reply: (text: string) => Promise<void>
  replyCalls: string[]
}

function makeCtx(overrides: { from?: { id: number }, locale?: string } = {}): CtxStub {
  const setLocaleCalls: string[] = []
  const replyCalls: string[] = []
  return {
    from: overrides.from ?? { id: 7 },
    i18n: {
      getLocale: async () => overrides.locale ?? 'en',
      setLocale: async (locale) => { setLocaleCalls.push(locale) },
      setLocaleCalls,
    },
    t: (key) => `t(${key})`,
    reply: async (text) => { replyCalls.push(text) },
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
      },
      ctx,
    ),
    /User not found/,
  )
})

test('attachUser persists default-en when locale is unsupported and does not reply', async () => {
  const ctx = makeCtx({ from: { id: 7 }, locale: 'jp' })
  const user = makeUser()

  const { nextCalls } = await run(
    {
      findOrCreateUser: async () => user as unknown as UserDoc,
      supportedLocales: ['en', 'ru'],
    },
    ctx,
  )

  assert.equal(nextCalls, 1)
  assert.equal(user.language, 'en')
  assert.equal(user.languageSelected, true)
  assert.equal(user.saveCalls, 1)
  assert.equal(ctx.replyCalls.length, 0)
  assert.deepEqual(ctx.i18n.setLocaleCalls, ['en'])
})

test('attachUser accepts a supported locale', async () => {
  const ctx = makeCtx({ from: { id: 7 }, locale: 'ru' })
  const user = makeUser()

  await run(
    {
      findOrCreateUser: async () => user as unknown as UserDoc,
      supportedLocales: ['en', 'ru'],
    },
    ctx,
  )

  assert.equal(user.language, 'ru')
  assert.equal(user.languageSelected, true)
  assert.equal(user.saveCalls, 1)
  assert.equal(ctx.replyCalls.length, 0)
  assert.deepEqual(ctx.i18n.setLocaleCalls, ['ru'])
})

test('attachUser skips locale selection when user already has a language set', async () => {
  const ctx = makeCtx({ from: { id: 7 } })
  const user = makeUser({ language: 'ru', languageSelected: true })

  await run(
    {
      findOrCreateUser: async () => user as unknown as UserDoc,
      supportedLocales: ['en', 'ru'],
    },
    ctx,
  )

  assert.equal(user.saveCalls, 0)
  assert.equal(ctx.replyCalls.length, 0)
  assert.deepEqual(ctx.i18n.setLocaleCalls, ['ru'])
})

test('attachUser attaches the resolved user onto ctx.dbuser', async () => {
  const ctx = makeCtx({ from: { id: 7 } })
  const user = makeUser({ id: 42, language: 'en', languageSelected: true })

  await run(
    {
      findOrCreateUser: async () => user as unknown as UserDoc,
      supportedLocales: ['en'],
    },
    ctx,
  )

  assert.equal(ctx.dbuser, user as unknown as UserStub)
})
