/* eslint-disable test/no-import-node-test */
import type { InitData } from '@telegram-apps/init-data-node'
import type { WalletNonceHandlerDependencies } from '#root/backend/wallet-nonce-handler'
import assert from 'node:assert/strict'
import process from 'node:process'
import test from 'node:test'
import fastify from 'fastify'
import { buildWalletNonceHandler } from '#root/backend/wallet-nonce-handler'

interface Ctx {
  app: ReturnType<typeof fastify>
  unhandledErrorLogs: string[]
  issueCalls: number[]
}

async function createCtx(overrides: Partial<WalletNonceHandlerDependencies> = {}): Promise<Ctx> {
  const unhandledErrorLogs: string[] = []
  const issueCalls: number[] = []

  const dependencies: WalletNonceHandlerDependencies = {
    validateInitData: () => {},
    parseInitData: () => ({ user: { id: 1001 } } as InitData),
    issueNonce: (userId) => {
      issueCalls.push(userId)
      return { payload: `payload-for-${userId}`, validUntil: 9999 }
    },
    logError: (message) => unhandledErrorLogs.push(message),
    ...overrides,
  }

  const app = fastify()
  await app.register(buildWalletNonceHandler(dependencies), { prefix: '/api/auth' })
  return { app, unhandledErrorLogs, issueCalls }
}

test('POST /api/auth/wallet-nonce returns a payload for the Telegram user', async (t) => {
  const ctx = await createCtx()
  t.after(async () => await ctx.app.close())

  const response = await ctx.app.inject({
    method: 'POST',
    url: '/api/auth/wallet-nonce',
    payload: { initData: 'signed' },
  })

  assert.equal(response.statusCode, 200)
  const body = response.json()
  assert.equal(body.payload, 'payload-for-1001')
  assert.equal(body.validUntil, 9999)
  assert.deepEqual(ctx.issueCalls, [1001])
})

test('POST /api/auth/wallet-nonce rejects missing initData', async (t) => {
  const ctx = await createCtx()
  t.after(async () => await ctx.app.close())

  const response = await ctx.app.inject({
    method: 'POST',
    url: '/api/auth/wallet-nonce',
    payload: {},
  })

  assert.equal(response.json().error, 'No initData provided')
})

test('POST /api/auth/wallet-nonce rejects ill-typed initData via schema', async (t) => {
  const ctx = await createCtx()
  t.after(async () => await ctx.app.close())

  const response = await ctx.app.inject({
    method: 'POST',
    url: '/api/auth/wallet-nonce',
    payload: { initData: { not: 'a string' } },
  })

  assert.equal(response.json().error, 'Invalid request body')
})

test('POST /api/auth/wallet-nonce sanitizes thrown errors', async (t) => {
  const ctx = await createCtx({
    validateInitData: () => {
      throw new Error('hash invalid: leaked detail')
    },
  })
  t.after(async () => await ctx.app.close())

  const response = await ctx.app.inject({
    method: 'POST',
    url: '/api/auth/wallet-nonce',
    payload: { initData: 'signed' },
  })

  assert.equal(response.statusCode, 200)
  assert.equal(response.json().error, 'Unable to process request')
  assert.equal(ctx.unhandledErrorLogs.length, 1)
})

test('POST /api/auth/wallet-nonce rejects when initData has no user id', async (t) => {
  const ctx = await createCtx({
    parseInitData: () => ({ user: undefined } as unknown as InitData),
  })
  t.after(async () => await ctx.app.close())

  const response = await ctx.app.inject({
    method: 'POST',
    url: '/api/auth/wallet-nonce',
    payload: { initData: 'signed' },
  })

  assert.equal(response.json().error, 'Invalid telegram user id')
  assert.deepEqual(ctx.issueCalls, [])
})

test('default validateInitData refuses to run without BOT_TOKEN', async (t) => {
  const saved = process.env.BOT_TOKEN
  delete process.env.BOT_TOKEN
  const app = fastify()
  await app.register(buildWalletNonceHandler(), { prefix: '/api/auth' })
  t.after(async () => {
    await app.close()
    if (saved === undefined) delete process.env.BOT_TOKEN
    else process.env.BOT_TOKEN = saved
  })

  const response = await app.inject({
    method: 'POST',
    url: '/api/auth/wallet-nonce',
    payload: { initData: 'signed' },
  })

  assert.equal(response.statusCode, 200)
  assert.equal(response.json().error, 'Unable to process request')
})
