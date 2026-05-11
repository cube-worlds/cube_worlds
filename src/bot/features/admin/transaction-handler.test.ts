/* eslint-disable test/no-import-node-test */
import type { Context } from '#root/bot/context'
import type { TransactionAcceptedTx } from '#root/bot/features/admin/transaction-handler'
import type { Transaction } from '#root/common/models/Transaction'
import type { UserDoc } from '#root/common/models/User'
import type { Api, RawApi } from 'grammy'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildTransactionCommandHandler } from '#root/bot/features/admin/transaction-handler'
import { BalanceChangeType } from '#root/common/models/Balance'

interface CtxStub {
  match: string
  api: Api<RawApi>
  replyCalls: string[]
  reply: (text: string) => Promise<void>
}

function makeCtx(match: string): CtxStub {
  const replyCalls: string[] = []
  return {
    match,
    api: { __id: 'api' } as unknown as Api<RawApi>,
    replyCalls,
    reply: async (text) => { replyCalls.push(text) },
  }
}

type TxStub = Transaction & TransactionAcceptedTx & { saveCalls: number }

function makeTx(overrides: Partial<TxStub> = {}): TxStub {
  const stub = {
    accepted: undefined,
    coins: 1_000_000_000, // 1 TON in nano
    save: async () => { stub.saveCalls += 1 },
    saveCalls: 0,
    ...overrides,
  } as TxStub
  return stub
}

interface UserStub {
  id: number
  name?: string
  minted: boolean
}

test('handler replies with usage hint when no argument is provided', async () => {
  const ctx = makeCtx('')
  const handler = buildTransactionCommandHandler({
    findTransaction: async () => makeTx(),
    findUserByName: async () => null,
    addPoints: async () => {},
    sendPlaceInLine: async () => {},
    sendMessageToAdmins: async () => {},
  })

  await handler(ctx as unknown as Context)
  assert.deepEqual(ctx.replyCalls, ['`/transaction` hash lt username'])
})

test('handler replies "not found" when findTransaction returns null', async () => {
  const ctx = makeCtx('  abc 42 @bob  ')
  const handler = buildTransactionCommandHandler({
    findTransaction: async (lt, hash) => {
      assert.equal(lt, 42)
      assert.equal(hash, 'abc')
      return null
    },
    findUserByName: async () => null,
    addPoints: async () => {},
    sendPlaceInLine: async () => {},
    sendMessageToAdmins: async () => {},
  })

  await handler(ctx as unknown as Context)
  assert.deepEqual(ctx.replyCalls, [
    'Transaction with hash `abc` and lt `42` not found',
  ])
})

test('handler replies "already accepted" when trx.accepted is true', async () => {
  const ctx = makeCtx('abc 42 @bob')
  let addPointsCalls = 0
  const handler = buildTransactionCommandHandler({
    findTransaction: async () => makeTx({ accepted: true }),
    findUserByName: async () => null,
    addPoints: async () => { addPointsCalls += 1 },
    sendPlaceInLine: async () => {},
    sendMessageToAdmins: async () => {},
  })

  await handler(ctx as unknown as Context)
  assert.deepEqual(ctx.replyCalls, ['Transaction is already accepted!'])
  assert.equal(addPointsCalls, 0)
})

test('handler replies "Username is empty!" when username is missing', async () => {
  const ctx = makeCtx('abc 42')
  const handler = buildTransactionCommandHandler({
    findTransaction: async () => makeTx(),
    findUserByName: async () => null,
    addPoints: async () => {},
    sendPlaceInLine: async () => {},
    sendMessageToAdmins: async () => {},
  })

  await handler(ctx as unknown as Context)
  assert.deepEqual(ctx.replyCalls, ['Username is empty!'])
})

test('handler replies "User ... not found" when findUserByName returns null', async () => {
  const ctx = makeCtx('abc 42 @missing')
  const handler = buildTransactionCommandHandler({
    findTransaction: async () => makeTx(),
    findUserByName: async (name) => {
      assert.equal(name, 'missing') // leading @ stripped
      return null
    },
    addPoints: async () => {},
    sendPlaceInLine: async () => {},
    sendMessageToAdmins: async () => {},
  })

  await handler(ctx as unknown as Context)
  assert.deepEqual(ctx.replyCalls, ['User @missing not found'])
})

test('handler accepts the transaction, credits points, and notifies on success', async () => {
  const ctx = makeCtx('abc 42 @bob')
  const tx = makeTx({ coins: 2_000_000_000 }) // 2 TON
  const user: UserStub = { id: 99, name: 'bob', minted: true }

  const addPointsCalls: Array<{ userId: number, amount: bigint, type: BalanceChangeType }> = []
  const placeInLineCalls: Array<{ userId: number, success: boolean }> = []
  const adminMessages: string[] = []

  const handler = buildTransactionCommandHandler({
    findTransaction: async () => tx,
    findUserByName: async () => user as unknown as UserDoc,
    addPoints: async (userId, amount, type) => {
      addPointsCalls.push({ userId, amount, type })
    },
    sendPlaceInLine: async (_api, userId, success) => {
      placeInLineCalls.push({ userId, success })
    },
    sendMessageToAdmins: async (_api, text) => { adminMessages.push(text) },
  })

  await handler(ctx as unknown as Context)

  // No replies on success
  assert.equal(ctx.replyCalls.length, 0)
  // tx persisted as accepted
  assert.equal(tx.accepted, true)
  assert.equal(tx.saveCalls, 1)
  // points credited (2 TON → tonToPoints)
  assert.equal(addPointsCalls.length, 1)
  assert.equal(addPointsCalls[0].userId, 99)
  assert.equal(addPointsCalls[0].type, BalanceChangeType.Donation)
  assert.ok(addPointsCalls[0].amount > 0n)
  // place-in-line ping with success=true
  assert.deepEqual(placeInLineCalls, [{ userId: 99, success: true }])
  // admin announcement contains the ✅ for minted user
  assert.equal(adminMessages.length, 1)
  assert.match(adminMessages[0], /FOUND TX OF @bob FOR 2 TON\. Minted: ✅/)
})

test('handler announces ❌ in the admin message for a non-minted user', async () => {
  const ctx = makeCtx('abc 42 bob') // no @ prefix
  const adminMessages: string[] = []
  const handler = buildTransactionCommandHandler({
    findTransaction: async () => makeTx({ coins: 500_000_000 }), // 0.5 TON
    findUserByName: async (name) => {
      assert.equal(name, 'bob')
      return { id: 1, name: 'bob', minted: false } as unknown as UserDoc
    },
    addPoints: async () => {},
    sendPlaceInLine: async () => {},
    sendMessageToAdmins: async (_api, text) => { adminMessages.push(text) },
  })

  await handler(ctx as unknown as Context)
  assert.equal(adminMessages.length, 1)
  assert.match(adminMessages[0], /Minted: ❌/)
})
