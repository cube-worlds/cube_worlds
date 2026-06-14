/* eslint-disable test/no-import-node-test */
import type {
  ApprovalUser,
  QueueApprovalDependencies,
} from '#root/bot/features/admin/queue-approval-handler'
import assert from 'node:assert/strict'
import test from 'node:test'
import { buildQueueApproval } from '#root/bot/features/admin/queue-approval-handler'

const FLOOR = { base: 0n, step: 500n, cap: 100_000n }

interface Recorder {
  deps: QueueApprovalDependencies
  mintCalls: number
  pinCalls: number
  markMintedCalls: Array<{ userId: number, nftUrl: string }>
  releaseCalls: number[]
  reworkCalls: number[]
  notifiedApproved: number[]
  notifiedReturned: number[]
  errors: string[]
}

interface Overrides {
  mintedCount?: number
  // claimForMint behaviour: by default true once then false (simulating CAS).
  claimForMint?: () => Promise<boolean>
  mintThrows?: boolean
  pinThrows?: boolean
}

function makeDeps(overrides: Overrides = {}): Recorder {
  let claimsTaken = 0
  const markMintedCalls: Recorder['markMintedCalls'] = []
  const releaseCalls: number[] = []
  const reworkCalls: number[] = []
  const notifiedApproved: number[] = []
  const notifiedReturned: number[] = []
  const errors: string[] = []
  const rec: Partial<Recorder> = {
    mintCalls: 0,
    pinCalls: 0,
    markMintedCalls,
    releaseCalls,
    reworkCalls,
    notifiedApproved,
    notifiedReturned,
    errors,
  }

  const deps: QueueApprovalDependencies = {
    floorParams: () => FLOOR,
    countMinted: async () => overrides.mintedCount ?? 0,
    claimForMint:
      overrides.claimForMint
      ?? (async () => {
        // First caller wins; subsequent callers lose (atomic CAS emulation).
        claimsTaken += 1
        return claimsTaken === 1
      }),
    releaseClaim: async (userId) => {
      releaseCalls.push(userId)
    },
    pinToIpfs: async () => {
      rec.pinCalls! += 1
      if (overrides.pinThrows) throw new Error('pin down')
      return { imageHash: 'imgHash', jsonHash: 'jsonHash' }
    },
    mintOnChain: async () => {
      rec.mintCalls! += 1
      if (overrides.mintThrows) throw new Error('chain down')
      return 'https://getgems.io/nft/xyz'
    },
    markMinted: async (userId, nftUrl) => {
      markMintedCalls.push({ userId, nftUrl })
    },
    setRework: async (userId) => {
      reworkCalls.push(userId)
    },
    notifyApproved: async (user) => {
      notifiedApproved.push(user.id)
    },
    notifyReturned: async (user) => {
      notifiedReturned.push(user.id)
    },
    logError: (m) => errors.push(m),
  }

  rec.deps = deps
  return rec as Recorder
}

function eligibleUser(overrides: Partial<ApprovalUser> = {}): ApprovalUser {
  return {
    id: 1001,
    name: 'alice',
    wallet: 'EQC_wallet',
    votes: 1_000n,
    minted: false,
    image: '/data/alice/alice_0.png',
    nftDescription: 'a hero',
    ...overrides,
  }
}

// APPROVE — happy path

test('approve pins, mints on-chain, flips minted, and notifies', async () => {
  const rec = makeDeps()
  const { approve } = buildQueueApproval(rec.deps)

  const result = await approve(eligibleUser())

  assert.deepEqual(result, { ok: true, nftUrl: 'https://getgems.io/nft/xyz' })
  assert.equal(rec.mintCalls, 1)
  assert.deepEqual(rec.markMintedCalls, [
    { userId: 1001, nftUrl: 'https://getgems.io/nft/xyz' },
  ])
  assert.deepEqual(rec.notifiedApproved, [1001])
  assert.equal(rec.releaseCalls.length, 0, 'no release on success')
})

// APPROVE — re-entrancy: double approve mints exactly once

test('approve is idempotent — a second approve does NOT mint again', async () => {
  const rec = makeDeps() // claimForMint: true once, then false
  const { approve } = buildQueueApproval(rec.deps)
  const user = eligibleUser()

  const first = await approve(user)
  const second = await approve(user)

  assert.equal(first.ok, true)
  assert.equal(second.ok, false)
  assert.equal(rec.mintCalls, 1, 'mint seam called EXACTLY once on double approve')
  assert.equal(rec.markMintedCalls.length, 1)
})

// APPROVE — illegal transitions

test('approve refuses an already-minted user and never mints', async () => {
  const rec = makeDeps()
  const { approve } = buildQueueApproval(rec.deps)

  const result = await approve(eligibleUser({ minted: true }))
  assert.deepEqual(result, { ok: false, reason: 'already-minted' })
  assert.equal(rec.mintCalls, 0)
})

test('approve refuses a below-floor user (server-side eligibility re-check)', async () => {
  // 10 minted → floor 5000; user has 4999 → below floor
  const rec = makeDeps({ mintedCount: 10 })
  const { approve } = buildQueueApproval(rec.deps)

  const result = await approve(eligibleUser({ votes: 4_999n }))
  assert.deepEqual(result, { ok: false, reason: 'below-floor' })
  assert.equal(rec.mintCalls, 0)
})

test('approve refuses a user with no bound wallet', async () => {
  const rec = makeDeps()
  const { approve } = buildQueueApproval(rec.deps)

  const result = await approve(eligibleUser({ wallet: undefined }))
  assert.deepEqual(result, { ok: false, reason: 'no-wallet' })
  assert.equal(rec.mintCalls, 0)
})

// APPROVE — failure releases the claim (no NFT delivered)

test('approve releases the claim when the on-chain mint throws', async () => {
  const rec = makeDeps({ mintThrows: true })
  const { approve } = buildQueueApproval(rec.deps)

  const result = await approve(eligibleUser())
  assert.equal(result.ok, false)
  assert.deepEqual(rec.releaseCalls, [1001], 'claim released for retry')
  assert.equal(rec.markMintedCalls.length, 0, 'never flips minted on mint failure')
})

// RETURN — sets Rework, never mints

test('returnToWork sets Rework and does NOT mint', async () => {
  const rec = makeDeps()
  const { returnToWork } = buildQueueApproval(rec.deps)

  const result = await returnToWork(eligibleUser())
  assert.deepEqual(result, { ok: true })
  assert.deepEqual(rec.reworkCalls, [1001])
  assert.deepEqual(rec.notifiedReturned, [1001])
  assert.equal(rec.mintCalls, 0, 'return never mints')
})

test('returnToWork refuses an already-minted user', async () => {
  const rec = makeDeps()
  const { returnToWork } = buildQueueApproval(rec.deps)

  const result = await returnToWork(eligibleUser({ minted: true }))
  assert.deepEqual(result, { ok: false, reason: 'already-minted' })
  assert.deepEqual(rec.reworkCalls, [], 'no Rework transition for minted user')
})
