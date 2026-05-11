/* eslint-disable test/no-import-node-test */
import type { Context } from '#root/bot/context'
import type { Api, RawApi } from 'grammy'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildCheckNotMinted } from '#root/bot/middlewares/check-not-minted'

interface SendCall {
  api: Api<RawApi>
  userId: number
  userLocale: string
  nftUrl: string
}

interface DbUserStub {
  id: number
  language: string
  minted: boolean
  nftUrl?: string
}

function makeCtx(dbuser: DbUserStub): Context {
  return {
    api: { __id: 'fake-api' } as unknown as Api<RawApi>,
    dbuser,
  } as unknown as Context
}

test('buildCheckNotMinted calls next() when the user has not been minted', async () => {
  const sendCalls: SendCall[] = []
  const middleware = buildCheckNotMinted({
    sendMintedMessage: async (api, userId, userLocale, nftUrl) => {
      sendCalls.push({ api, userId, userLocale, nftUrl })
    },
  })

  let nextCalls = 0
  await middleware(
    makeCtx({ id: 7, language: 'en', minted: false }),
    async () => { nextCalls += 1 },
  )

  assert.equal(nextCalls, 1)
  assert.equal(sendCalls.length, 0)
})

test('buildCheckNotMinted short-circuits and forwards minted-user details to sendMintedMessage', async () => {
  const sendCalls: SendCall[] = []
  const middleware = buildCheckNotMinted({
    sendMintedMessage: async (api, userId, userLocale, nftUrl) => {
      sendCalls.push({ api, userId, userLocale, nftUrl })
      return 'sent'
    },
  })

  let nextCalls = 0
  await middleware(
    makeCtx({
      id: 42,
      language: 'ru',
      minted: true,
      nftUrl: 'https://getgems.io/foo',
    }),
    async () => { nextCalls += 1 },
  )

  assert.equal(nextCalls, 0)
  assert.equal(sendCalls.length, 1)
  assert.equal(sendCalls[0].userId, 42)
  assert.equal(sendCalls[0].userLocale, 'ru')
  assert.equal(sendCalls[0].nftUrl, 'https://getgems.io/foo')
})

test('buildCheckNotMinted falls back to an empty nftUrl when the user has none', async () => {
  const sendCalls: SendCall[] = []
  const middleware = buildCheckNotMinted({
    sendMintedMessage: async (api, userId, userLocale, nftUrl) => {
      sendCalls.push({ api, userId, userLocale, nftUrl })
    },
  })

  await middleware(
    makeCtx({ id: 8, language: 'en', minted: true }),
    async () => {},
  )

  assert.equal(sendCalls.length, 1)
  assert.equal(sendCalls[0].nftUrl, '')
})
