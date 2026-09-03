/* eslint-disable test/no-import-node-test */
import type {
  ApprovalUser,
  QueueApprovalDependencies,
} from '#root/bot/features/admin/queue-approval-handler'
import assert from 'node:assert/strict'
import test from 'node:test'
import { buildQueueApproval } from '#root/bot/features/admin/queue-approval-handler'

interface Recorder {
  deps: QueueApprovalDependencies
  mintCalls: number
  pinCalls: number
  markMintedCalls: Array<{ userId: number, nftUrl: string }>
  releaseCalls: number[]
  reworkCalls: number[]
  notifiedApproved: number[]
  notifiedDeclined: number[]
  errors: string[]
}

interface Overrides {
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
  const notifiedDeclined: number[] = []
  const errors: string[] = []
  const rec: Partial<Recorder> = {
    mintCalls: 0,
    pinCalls: 0,
    markMintedCalls,
    releaseCalls,
    reworkCalls,
    notifiedApproved,
    notifiedDeclined,
    errors,
  }

  const deps: QueueApprovalDependencies = {
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
    notifyDeclined: async (user) => {
      notifiedDeclined.push(user.id)
    },
    logError: (m) => errors.push(m),
  }

  rec.deps = deps
  return rec as Recorder
}

function submittedUser(overrides: Partial<ApprovalUser> = {}): ApprovalUser {
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

  const result = await approve(submittedUser())

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
  const user = submittedUser()

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

  const result = await approve(submittedUser({ minted: true }))
  assert.deepEqual(result, { ok: false, reason: 'already-minted' })
  assert.equal(rec.mintCalls, 0)
})

test('approve refuses a user with no bound wallet', async () => {
  const rec = makeDeps()
  const { approve } = buildQueueApproval(rec.deps)

  const result = await approve(submittedUser({ wallet: undefined }))
  assert.deepEqual(result, { ok: false, reason: 'no-wallet' })
  assert.equal(rec.mintCalls, 0)
})

test('approve refuses a user without a draft', async () => {
  const rec = makeDeps()
  const { approve } = buildQueueApproval(rec.deps)

  const result = await approve(submittedUser({ image: undefined }))
  assert.deepEqual(result, { ok: false, reason: 'no-draft' })
  assert.equal(rec.mintCalls, 0)
})

// APPROVE — failure releases the claim (no NFT delivered)

test('approve releases the claim when the on-chain mint throws', async () => {
  const rec = makeDeps({ mintThrows: true })
  const { approve } = buildQueueApproval(rec.deps)

  const result = await approve(submittedUser())
  assert.equal(result.ok, false)
  assert.deepEqual(rec.releaseCalls, [1001], 'claim released for retry')
  assert.equal(rec.markMintedCalls.length, 0, 'never flips minted on mint failure')
})

// DECLINE — sets Rework, never mints

test('decline sets Rework and does NOT mint', async () => {
  const rec = makeDeps()
  const { decline } = buildQueueApproval(rec.deps)

  const result = await decline(submittedUser())
  assert.deepEqual(result, { ok: true })
  assert.deepEqual(rec.reworkCalls, [1001])
  assert.deepEqual(rec.notifiedDeclined, [1001])
  assert.equal(rec.mintCalls, 0, 'decline never mints')
})

test('decline refuses an already-minted user', async () => {
  const rec = makeDeps()
  const { decline } = buildQueueApproval(rec.deps)

  const result = await decline(submittedUser({ minted: true }))
  assert.deepEqual(result, { ok: false, reason: 'already-minted' })
  assert.deepEqual(rec.reworkCalls, [], 'no Rework transition for minted user')
})
