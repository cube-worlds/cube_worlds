/* eslint-disable test/no-import-node-test */
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import process from 'node:process'
import test from 'node:test'
import { ClientError } from '#root/common/errors'
import { defaultValidateInitData, SESSION_EXPIRED_MESSAGE } from './init-data'

const BOT_TOKEN = '123456789:TEST-FAKE-TOKEN-abcdef'

function signInitData(authDate: Date): string {
  const params = new URLSearchParams()
  params.set('auth_date', String(Math.floor(authDate.getTime() / 1000)))
  params.set('user', JSON.stringify({ id: 1, first_name: 'T' }))
  const pairs = [...params.entries()].map(([k, v]) => `${k}=${v}`).sort()
  const secret = crypto.createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest()
  params.set(
    'hash',
    crypto.createHmac('sha256', secret).update(pairs.join('\n')).digest('hex'),
  )
  return params.toString()
}

test('defaultValidateInitData accepts fresh initData', () => {
  process.env.BOT_TOKEN = BOT_TOKEN
  assert.doesNotThrow(() => defaultValidateInitData(signInitData(new Date())))
})

test('defaultValidateInitData reports expired initData as a ClientError', () => {
  process.env.BOT_TOKEN = BOT_TOKEN
  const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000)
  assert.throws(
    () => defaultValidateInitData(signInitData(twoDaysAgo)),
    (err: unknown) =>
      err instanceof ClientError && err.message === SESSION_EXPIRED_MESSAGE,
  )
})

test('defaultValidateInitData keeps a tampered signature generic', () => {
  process.env.BOT_TOKEN = BOT_TOKEN
  const tampered = signInitData(new Date()).replace(/hash=\w/, 'hash=0')
  assert.throws(
    () => defaultValidateInitData(tampered),
    (err: unknown) => err instanceof Error && !(err instanceof ClientError),
  )
})
