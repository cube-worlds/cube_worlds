/* eslint-disable test/no-import-node-test */
import type { Address, Transaction } from '@ton/core'
import type {
  SavedTransaction,
  SubscriptionDependencies,
  SubscriptionUser,
  TransactionRecord,
} from '#root/subscription-core'
import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import test from 'node:test'
import { beginCell, Cell, Address as TonAddress, toNano } from '@ton/core'
import { BalanceChangeType } from '#root/common/models/Balance'
import { processTransaction } from '#root/subscription-core'

const SENDER = TonAddress.parse(
  '0QC4sEG_VQ4QawHnr77mqJhC98cpoyI-0gXuwR76Ff2kT4eI',
)
const FAKE_HASH = Buffer.alloc(32, 7) // deterministic 32-byte hash
const DEFAULT_LT = 12345n
const DEFAULT_NOW = 1700000000

interface BuildTxOpts {
  outMessagesCount?: number
  inMessage?: 'none' | 'external' | 'internal'
  body?: Cell
  value?: bigint
  src?: Address
  lt?: bigint
  now?: number
  hash?: Buffer
}

function buildTransaction(opts: BuildTxOpts = {}): Transaction {
  const {
    outMessagesCount = 0,
    inMessage = 'internal',
    body = new Cell(),
    value = toNano('1'),
    src = SENDER,
    lt = DEFAULT_LT,
    now = DEFAULT_NOW,
    hash = FAKE_HASH,
  } = opts

  let inMessageObj: unknown
  if (inMessage === 'none') {
    inMessageObj = undefined
  } else if (inMessage === 'external') {
    inMessageObj = { info: { type: 'external-in' }, body }
  } else {
    inMessageObj = {
      info: { type: 'internal', src, value: { coins: value } },
      body,
    }
  }

  return {
    outMessagesCount,
    inMessage: inMessageObj,
    lt,
    now,
    hash: () => hash,
  } as unknown as Transaction
}

function textBody(text: string): Cell {
  return beginCell().storeUint(0, 32).storeStringTail(text).endCell()
}

interface RecordedDeps {
  deps: SubscriptionDependencies
  saved: TransactionRecord[]
  rejected: TransactionRecord[]
  addPointsCalls: Array<{
    userId: number
    delta: bigint
    type: BalanceChangeType
  }>
  userMessages: Array<{ userId: number, text: string }>
  adminMessages: string[]
  donationTranslations: Array<{ language: string, ton: number }>
  logs: { info: string[], error: string[], debug: string[] }
}

interface DepsOverrides {
  existing?: unknown
  user?: SubscriptionUser | null
  saveThrows?: boolean
}

function makeDeps(overrides: DepsOverrides = {}): RecordedDeps {
  const saved: TransactionRecord[] = []
  const rejected: TransactionRecord[] = []
  const addPointsCalls: RecordedDeps['addPointsCalls'] = []
  const userMessages: RecordedDeps['userMessages'] = []
  const adminMessages: string[] = []
  const donationTranslations: RecordedDeps['donationTranslations'] = []
  const logs = { info: [] as string[], error: [] as string[], debug: [] as string[] }

  const deps: SubscriptionDependencies = {
    findExistingTransaction: async () => overrides.existing ?? null,
    saveTransaction: async (record) => {
      saved.push(record)
      const handle: SavedTransaction = {
        markRejected: async () => {
          rejected.push(record)
        },
      }
      return handle
    },
    findUserByAddress: async () =>
      overrides.user === undefined ? null : overrides.user,
    addPoints: async (userId, delta, type) => {
      addPointsCalls.push({ userId, delta, type })
      return delta
    },
    sendMessage: async (userId, text) => {
      userMessages.push({ userId, text })
    },
    sendMessageToAdmins: async (text) => {
      adminMessages.push(text)
    },
    translateDonation: (language, ton) => {
      donationTranslations.push({ language, ton })
      return `donation-msg(${language},${ton})`
    },
    info: (msg) => logs.info.push(msg),
    error: (msg) => logs.error.push(msg),
    debug: (msg) => logs.debug.push(msg),
  }

  return {
    deps,
    saved,
    rejected,
    addPointsCalls,
    userMessages,
    adminMessages,
    donationTranslations,
    logs,
  }
}

const defaultUser: SubscriptionUser = {
  id: 555,
  votes: BigInt(10_000_000),
  language: 'en',
  name: 'alice',
  minted: false,
}

// 1. SKIP CONDITIONS

test('processTransaction skips bounced txs (outMessagesCount > 0)', async () => {
  const ctx = makeDeps()
  const tx = buildTransaction({ outMessagesCount: 1 })

  await processTransaction(tx, ctx.deps)

  assert.equal(ctx.saved.length, 0)
  assert.equal(ctx.userMessages.length, 0)
  assert.equal(ctx.adminMessages.length, 0)
})

test('processTransaction skips txs with no inMessage', async () => {
  const ctx = makeDeps()
  const tx = buildTransaction({ inMessage: 'none' })

  await processTransaction(tx, ctx.deps)

  assert.equal(ctx.saved.length, 0)
})

test('processTransaction skips external inbound messages', async () => {
  const ctx = makeDeps()
  const tx = buildTransaction({ inMessage: 'external' })

  await processTransaction(tx, ctx.deps)

  assert.equal(ctx.saved.length, 0)
})

test('processTransaction is idempotent against already-known txs', async () => {
  const ctx = makeDeps({ existing: { lt: DEFAULT_LT.toString() } })
  const tx = buildTransaction({ value: toNano('1') })

  await processTransaction(tx, ctx.deps)

  assert.equal(ctx.saved.length, 0)
  assert.equal(ctx.addPointsCalls.length, 0)
  assert.equal(ctx.logs.debug.length, 1, 'logs duplicate skip')
})

// 2. PERSISTENCE

test('processTransaction persists tx record with derived fields', async () => {
  const ctx = makeDeps({ user: defaultUser })
  const value = toNano('0.5')
  const tx = buildTransaction({ value, body: textBody('hello') })

  await processTransaction(tx, ctx.deps)

  assert.equal(ctx.saved.length, 1)
  const record = ctx.saved[0]
  assert.equal(record.lt, Number(DEFAULT_LT))
  assert.equal(record.utime, DEFAULT_NOW)
  assert.equal(record.coins, Number(value))
  assert.equal(record.ton, 0.5)
  assert.equal(record.hash, FAKE_HASH.toString('base64'))
  assert.equal(record.address, SENDER.toString())
  assert.equal(record.accepted, true)
})

// 3. USER NOT FOUND

test('processTransaction marks rejected and alerts admins for unknown sender (large)', async () => {
  const ctx = makeDeps({ user: null })
  const tx = buildTransaction({ value: toNano('5'), body: textBody('hello') })

  await processTransaction(tx, ctx.deps)

  assert.equal(ctx.saved.length, 1)
  assert.equal(ctx.rejected.length, 1, 'rejected marker recorded')
  assert.equal(ctx.adminMessages.length, 1)
  assert.match(ctx.adminMessages[0], /USER NOT FOUND/)
  assert.equal(ctx.logs.error.length, 1)
  assert.equal(ctx.addPointsCalls.length, 0)
  assert.equal(ctx.userMessages.length, 0)
})

test('processTransaction stays silent (no admin alert) for tiny unknown-sender txs', async () => {
  // tonToPoints rounds to 1n at near-zero TON, so points <= 1 → no admin alert
  const ctx = makeDeps({ user: null })
  // 0.000001 TON × ~1500 rate after halvings = ~0; clamped to 1n by tonToPoints
  const tx = buildTransaction({ value: 1n, body: textBody('test') })

  await processTransaction(tx, ctx.deps)

  assert.equal(ctx.rejected.length, 1)
  assert.equal(
    ctx.adminMessages.length,
    0,
    'no admin spam for negligible amounts',
  )
  assert.equal(ctx.logs.error.length, 1, 'still logs locally')
})

// 4. DONATION PATH

test('processTransaction credits points and translates donation message for known user', async () => {
  const ctx = makeDeps({ user: defaultUser })
  const tx = buildTransaction({
    value: toNano('1'),
    body: textBody('thanks!'),
  })

  await processTransaction(tx, ctx.deps)

  assert.equal(ctx.addPointsCalls.length, 1)
  assert.equal(ctx.addPointsCalls[0].userId, defaultUser.id)
  assert.equal(ctx.addPointsCalls[0].type, BalanceChangeType.Donation)
  assert.ok(
    ctx.addPointsCalls[0].delta > 0n,
    'donation credits positive points',
  )

  assert.equal(ctx.userMessages.length, 1)
  assert.equal(ctx.userMessages[0].userId, defaultUser.id)
  assert.deepEqual(ctx.donationTranslations, [{ language: 'en', ton: 1 }])
  assert.equal(ctx.userMessages[0].text, 'donation-msg(en,1)')

  assert.equal(ctx.adminMessages.length, 1)
  assert.match(ctx.adminMessages[0], /RECEIVED 1 TON FROM @alice/)
  assert.match(
    ctx.adminMessages[0],
    /with message "thanks!"/,
    'includes user-supplied comment',
  )
  assert.match(
    ctx.adminMessages[0],
    /Minted: ❌/,
    'shows mint state',
  )
})

test('processTransaction donation path includes minted flag for minted users', async () => {
  const user: SubscriptionUser = { ...defaultUser, minted: true }
  const ctx = makeDeps({ user })
  const tx = buildTransaction({ value: toNano('1') })

  await processTransaction(tx, ctx.deps)

  assert.match(ctx.adminMessages[0], /Minted: ✅/)
})

test('processTransaction donation path omits comment block when no message', async () => {
  const ctx = makeDeps({ user: defaultUser })
  const tx = buildTransaction({ value: toNano('1') }) // empty Cell body

  await processTransaction(tx, ctx.deps)

  assert.equal(ctx.adminMessages.length, 1)
  assert.doesNotMatch(
    ctx.adminMessages[0],
    /with message/,
    'no "with message" suffix when there is no comment',
  )
})

test('processTransaction donation respects user language for translated message', async () => {
  const user: SubscriptionUser = { ...defaultUser, language: 'ru' }
  const ctx = makeDeps({ user })
  const tx = buildTransaction({ value: toNano('2.5') })

  await processTransaction(tx, ctx.deps)

  assert.deepEqual(ctx.donationTranslations, [{ language: 'ru', ton: 2.5 }])
  assert.equal(ctx.userMessages[0].text, 'donation-msg(ru,2.5)')
})

// 5. ARBITRARY COMMENTS ARE TREATED AS DONATIONS

test('processTransaction treats any comment as a donation (no exchange branch)', async () => {
  const ctx = makeDeps({ user: defaultUser })
  const tx = buildTransaction({
    value: toNano('1'),
    body: textBody('s:1000'),
  })

  await processTransaction(tx, ctx.deps)

  // donation flow: positive points + admin message; the old "s:" exchange
  // branch is gone, so even an "s:"-prefixed comment now credits a donation.
  assert.equal(ctx.addPointsCalls.length, 1)
  assert.ok(ctx.addPointsCalls[0].delta > 0n)
  assert.equal(ctx.addPointsCalls[0].type, BalanceChangeType.Donation)
  assert.equal(ctx.adminMessages.length, 1)
})
