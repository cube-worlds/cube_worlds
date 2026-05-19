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

test('buildStartProcessTransactions propagates getLastestTransaction errors and never creates a subscription', async () => {
  let createCalls = 0
  const start = buildStartProcessTransactions({
    getCollectionOwner: () => 'EQO',
    getLastestTransaction: async () => { throw new Error('mongo down') },
    createSubscription: () => {
      createCalls += 1
      return { start: async () => {} }
    },
  })

  await assert.rejects(() => start(async () => {}), /mongo down/)
  assert.equal(createCalls, 0)
})

test('buildStartProcessTransactions propagates createSubscription errors and never calls start', async () => {
  const fake = makeFakeSubscription()
  const start = buildStartProcessTransactions({
    getCollectionOwner: () => 'EQO',
    getLastestTransaction: async () => ({ utime: 1 }),
    createSubscription: () => { throw new Error('bad address') },
  })

  await assert.rejects(() => start(async () => {}), /bad address/)
  assert.equal(fake.startCalls, 0)
})

test('buildStartProcessTransactions surfaces subscription.start() rejections', async () => {
  const start = buildStartProcessTransactions({
    getCollectionOwner: () => 'EQO',
    getLastestTransaction: async () => null,
    createSubscription: () => ({
      start: async () => { throw new Error('subscription crashed') },
    }),
  })

  await assert.rejects(() => start(async () => {}), /subscription crashed/)
})

test('buildStartProcessTransactions passes utime=0 through verbatim (boundary)', async () => {
  const created: number[] = []
  const fake = makeFakeSubscription()
  const start = buildStartProcessTransactions({
    getCollectionOwner: () => 'EQO',
    getLastestTransaction: async () => ({ utime: 0 }),
    createSubscription: (_address, startTime) => {
      created.push(startTime)
      return fake.sub
    },
  })

  await start(async () => {})
  assert.deepEqual(created, [0])
})

test('buildStartProcessTransactions creates a fresh subscription on each call', async () => {
  const startTimes: number[] = []
  let txCallCount = 0
  const utimes = [10, 20]
  const fake = makeFakeSubscription()
  const start = buildStartProcessTransactions({
    getCollectionOwner: () => 'EQO',
    getLastestTransaction: async () => {
      const utime = utimes[txCallCount]
      txCallCount += 1
      return { utime }
    },
    createSubscription: (_address, startTime) => {
      startTimes.push(startTime)
      return fake.sub
    },
  })

  await start(async () => {})
  await start(async () => {})

  assert.deepEqual(startTimes, [10, 20])
  assert.equal(fake.startCalls, 2)
})
