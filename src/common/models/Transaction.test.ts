/* eslint-disable test/no-import-node-test */
import type { DocumentType } from '@typegoose/typegoose'
import type { Transaction } from '#root/common/models/Transaction'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildTransactionHelpers } from '#root/common/models/Transaction'

function makeTx(overrides: Partial<Transaction> = {}): DocumentType<Transaction> {
  return {
    utime: 1,
    lt: 1,
    address: 'addr',
    coins: 0,
    hash: 'h',
    ...overrides,
  } as unknown as DocumentType<Transaction>
}

test('getLastestTransaction delegates to findLatestByUtime and returns the result', async () => {
  let calls = 0
  const tx = makeTx({ utime: 100, lt: 5, hash: 'abc' })
  const helpers = buildTransactionHelpers({
    findLatestByUtime: async () => { calls += 1; return tx },
    findByLtAndHash: async () => null,
  })

  assert.equal(await helpers.getLastestTransaction(), tx)
  assert.equal(calls, 1)
})

test('getLastestTransaction returns null when no transactions exist', async () => {
  const helpers = buildTransactionHelpers({
    findLatestByUtime: async () => null,
    findByLtAndHash: async () => null,
  })

  assert.equal(await helpers.getLastestTransaction(), null)
})

test('findTransaction forwards lt and hash to findByLtAndHash', async () => {
  const calls: { lt: number, hash: string }[] = []
  const tx = makeTx({ lt: 42, hash: 'xyz' })
  const helpers = buildTransactionHelpers({
    findLatestByUtime: async () => null,
    findByLtAndHash: async (lt, hash) => {
      calls.push({ lt, hash })
      return tx
    },
  })

  assert.equal(await helpers.findTransaction(42, 'xyz'), tx)
  assert.deepEqual(calls, [{ lt: 42, hash: 'xyz' }])
})

test('findTransaction returns null when no matching transaction is found', async () => {
  const helpers = buildTransactionHelpers({
    findLatestByUtime: async () => null,
    findByLtAndHash: async () => null,
  })

  assert.equal(await helpers.findTransaction(1, 'missing'), null)
})
