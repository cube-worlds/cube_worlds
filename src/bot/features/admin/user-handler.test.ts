/* eslint-disable test/no-import-node-test */
import type { Context } from '#root/bot/context'
import type { UserDoc } from '#root/common/models/User'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildUserCommandHandler } from '#root/bot/features/admin/user-handler'

interface CtxStub {
  match: string
  replyCalls: string[]
  reply: (text: string) => Promise<void>
}

function makeCtx(match: string): CtxStub {
  const replyCalls: string[] = []
  return {
    match,
    replyCalls,
    reply: async (text) => { replyCalls.push(text) },
  }
}

test('user handler replies with usage hint when no username argument is provided', async () => {
  const ctx = makeCtx('')
  let lookups = 0
  const handler = buildUserCommandHandler({
    findUserByName: async () => { lookups += 1; return null },
  })
  await handler(ctx as unknown as Context)
  assert.deepEqual(ctx.replyCalls, ['/user [username]'])
  assert.equal(lookups, 0)
})

test('user handler replies "User ... not found" when lookup returns null', async () => {
  const ctx = makeCtx('  @missing  ')
  const handler = buildUserCommandHandler({
    findUserByName: async (name) => {
      assert.equal(name, 'missing') // trimmed + @ stripped
      return null
    },
  })
  await handler(ctx as unknown as Context)
  assert.deepEqual(ctx.replyCalls, ['User @missing not found'])
})

test('user handler replies with user.toString() on a successful lookup', async () => {
  const ctx = makeCtx('bob')
  const user = { toString: () => 'USER[bob]' } as unknown as UserDoc
  const handler = buildUserCommandHandler({
    findUserByName: async (name) => {
      assert.equal(name, 'bob')
      return user
    },
  })
  await handler(ctx as unknown as Context)
  assert.deepEqual(ctx.replyCalls, ['USER[bob]'])
})
