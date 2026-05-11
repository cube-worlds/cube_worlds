/* eslint-disable test/no-import-node-test */
import type { Transaction } from '@ton/core'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildStartProcessTransactions } from '#root/subscription-start'

function makeFakeSubscription() {
  let startCalls = 0
  return {
    sub: { start: async () => { startCalls += 1 } },
    get startCalls() { return startCalls },
  }
}

test('buildStartProcessTransactions seeds AccountSubscription with the latest utime', async () => {
  const created: Array<{ address: string, startTime: number }> = []
  const fake = makeFakeSubscription()
  const onTx = async () => {}
  const start = buildStartProcessTransactions({
    getCollectionOwner: () => 'EQOwnerAddress',
    getLastestTransaction: async () => ({ utime: 12345 }),
    createSubscription: (address, startTime) => {
      created.push({ address, startTime })
      return fake.sub
    },
  })

  await start(onTx)

  assert.deepEqual(created, [{ address: 'EQOwnerAddress', startTime: 12345 }])
  assert.equal(fake.startCalls, 1)
})

test('buildStartProcessTransactions defaults startTime to 0 when there is no latest transaction', async () => {
  const created: number[] = []
  const fake = makeFakeSubscription()
  const start = buildStartProcessTransactions({
    getCollectionOwner: () => 'EQOwnerAddress',
    getLastestTransaction: async () => null,
    createSubscription: (_address, startTime) => {
      created.push(startTime)
      return fake.sub
    },
  })

  await start(async () => {})
  assert.deepEqual(created, [0])
})

test('buildStartProcessTransactions defaults startTime to 0 when latest tx has no utime field', async () => {
  const created: number[] = []
  const fake = makeFakeSubscription()
  const start = buildStartProcessTransactions({
    getCollectionOwner: () => 'EQOwnerAddress',
    getLastestTransaction: async () => ({}),
    createSubscription: (_address, startTime) => {
      created.push(startTime)
      return fake.sub
    },
  })

  await start(async () => {})
  assert.deepEqual(created, [0])
})

test('buildStartProcessTransactions forwards the onTransaction callback to the subscription', async () => {
  let forwarded: ((tx: Transaction) => Promise<void>) | null = null
  const fake = makeFakeSubscription()
  const start = buildStartProcessTransactions({
    getCollectionOwner: () => 'EQO',
    getLastestTransaction: async () => null,
    createSubscription: (_a, _s, onTransaction) => {
      forwarded = onTransaction
      return fake.sub
    },
  })

  const onTx = async () => {}
  await start(onTx)
  assert.equal(forwarded, onTx)
})

test('buildStartProcessTransactions awaits subscription.start()', async () => {
  const events: string[] = []
  const start = buildStartProcessTransactions({
    getCollectionOwner: () => 'EQO',
    getLastestTransaction: async () => null,
    createSubscription: () => ({
      start: async () => {
        events.push('start-begin')
        await Promise.resolve()
        events.push('start-end')
      },
    }),
  })

  await start(async () => {})
  events.push('after-await')
  assert.deepEqual(events, ['start-begin', 'start-end', 'after-await'])
})
