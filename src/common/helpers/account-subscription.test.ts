/* eslint-disable test/no-import-node-test */
import type { Address, Transaction } from '@ton/core'
import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { test } from 'node:test'
import { AccountSubscription } from '#root/common/helpers/account-subscription'

const TEST_ADDRESS = 'EQCd7tILlcnS89uI0OD4Zzz7yQHGLhGzBedk88PKGEbmv7zP'

interface GetTxCall {
  lt: string | undefined
  hash: string | undefined
}

function makeTx(now: number, lt: number, hash: string): Transaction {
  return {
    now,
    lt: BigInt(lt),
    hash: () => Buffer.from(hash, 'utf8'),
  } as unknown as Transaction
}

function makeSub(options: {
  startTime: number
  pages: Transaction[][]
  errors?: number
  onTransaction?: (tx: Transaction) => Promise<void>
}) {
  const getTxCalls: GetTxCall[] = []
  const sleepCalls: number[] = []
  let pageIndex = 0
  let errorsRemaining = options.errors ?? 0
  const processed: Transaction[] = []

  const sub = new AccountSubscription(
    TEST_ADDRESS,
    options.startTime,
    options.onTransaction
      ?? (async (tx) => { processed.push(tx) }),
    {
      getTransactions: async (
        _address: Address,
        opts: { lt: string | undefined, hash: string | undefined },
      ) => {
        getTxCalls.push({ lt: opts.lt, hash: opts.hash })
        if (errorsRemaining > 0) {
          errorsRemaining -= 1
          throw new Error('network')
        }
        const page = options.pages[pageIndex] ?? []
        pageIndex += 1
        return page
      },
      sleep: async (ms) => { sleepCalls.push(ms) },
      setInterval: () => 0,
    },
  )

  return { sub, getTxCalls, sleepCalls, processed }
}

test('AccountSubscription.start processes a single page and advances startTime', async () => {
  const tx1 = makeTx(110, 1, 'h1')
  const tx2 = makeTx(105, 2, 'h2')
  const { sub, getTxCalls, processed } = makeSub({
    startTime: 100,
    // First fetch returns 2 transactions, both above startTime;
    // because transactions.length > 1, fetchOnce recurses — the second call returns [].
    pages: [[tx1, tx2], []],
  })

  await sub.start()

  // First fetch has no offset; second uses last tx (lt=2, hash=h2 base64)
  assert.equal(getTxCalls.length, 2)
  assert.equal(getTxCalls[0].lt, undefined)
  assert.equal(getTxCalls[1].lt, '2')
  assert.equal(getTxCalls[1].hash, Buffer.from('h2', 'utf8').toString('base64'))

  // Both transactions processed
  assert.deepEqual(processed, [tx1, tx2])
  // cursorTime = first tx's now → startTime updated
  assert.equal(sub.startTime, 110)
})

test('AccountSubscription.start stops when a transaction is older than startTime', async () => {
  const tx1 = makeTx(200, 1, 'h1')
  const tx2 = makeTx(50, 2, 'h2') // older than startTime=100 → loop returns cursorTime
  const { sub, processed } = makeSub({
    startTime: 100,
    pages: [[tx1, tx2]],
  })

  await sub.start()

  // tx2 is dropped (older than startTime); only tx1 processed
  assert.deepEqual(processed, [tx1])
  // startTime advances to tx1.now
  assert.equal(sub.startTime, 200)
})

test('AccountSubscription.start does not advance startTime when no transactions are returned', async () => {
  const { sub, getTxCalls, processed } = makeSub({
    startTime: 100,
    pages: [[]],
  })

  await sub.start()

  assert.equal(getTxCalls.length, 1)
  assert.deepEqual(processed, [])
  assert.equal(sub.startTime, 100)
})

test('AccountSubscription.start retries with exponential-ish sleep and recovers on success', async () => {
  const tx = makeTx(150, 1, 'h')
  const { sub, getTxCalls, sleepCalls, processed } = makeSub({
    startTime: 100,
    errors: 3,
    pages: [[tx]],
  })

  await sub.start()

  // 3 failures + 1 success = 4 getTransactions calls
  assert.equal(getTxCalls.length, 4)
  // Sleeps fire after each failure with retryCount*1000 starting at 1
  assert.deepEqual(sleepCalls, [1000, 2000, 3000])
  assert.deepEqual(processed, [tx])
  assert.equal(sub.startTime, 150)
})

test('AccountSubscription.start gives up after 10 consecutive failures and leaves startTime untouched', async () => {
  const { sub, getTxCalls, sleepCalls, processed } = makeSub({
    startTime: 100,
    errors: 100, // exceed retry budget
    pages: [],
  })

  await sub.start()

  // 10 attempts (retryCount goes 0..9, on the 10th the if (nextRetry < 10) is false → return 0)
  assert.equal(getTxCalls.length, 10)
  // 9 sleeps between the 10 attempts
  assert.equal(sleepCalls.length, 9)
  assert.deepEqual(processed, [])
  // result is 0 → not > 0 → startTime untouched
  assert.equal(sub.startTime, 100)
})

test('AccountSubscription.start short-circuits the recursion when only one transaction is returned', async () => {
  const tx = makeTx(150, 1, 'h')
  const { sub, getTxCalls, processed } = makeSub({
    startTime: 100,
    // Only one transaction → no recursive fetch
    pages: [[tx]],
  })

  await sub.start()

  assert.equal(getTxCalls.length, 1)
  assert.deepEqual(processed, [tx])
  assert.equal(sub.startTime, 150)
})
