/* eslint-disable test/no-import-node-test */
import type {
  CNFTCreateInput,
  CNFTHelperDependencies,
  ExistingCNFTRef,
} from '#root/common/models/CNFT'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  buildCNFTHelpers,
  cnftHexColor,
  CNFTImageType,
  pickCNFTType,
  pickNextColor,
} from '#root/common/models/CNFT'
import { Address } from '@ton/core'

// pickCNFTType — diceWinner takes precedence over everything else

test('pickCNFTType: diceWinner wins regardless of votes/referrals', () => {
  assert.equal(pickCNFTType(0n, 0, true), CNFTImageType.Dice)
  assert.equal(pickCNFTType(2_000_000n, 100, true), CNFTImageType.Dice)
})

// pickCNFTType — vote tiers (using strict greater-than)

test('pickCNFTType: votes above 1_000_000 → Whale', () => {
  assert.equal(pickCNFTType(1_000_001n, 0, false), CNFTImageType.Whale)
  assert.equal(pickCNFTType(10_000_000n, 0, false), CNFTImageType.Whale)
})

test('pickCNFTType: votes exactly 1_000_000 → Diamond (strict >)', () => {
  assert.equal(pickCNFTType(1_000_000n, 0, false), CNFTImageType.Diamond)
})

test('pickCNFTType: votes between 500_001 and 1_000_000 → Diamond', () => {
  assert.equal(pickCNFTType(500_001n, 0, false), CNFTImageType.Diamond)
  assert.equal(pickCNFTType(750_000n, 0, false), CNFTImageType.Diamond)
})

test('pickCNFTType: votes exactly 500_000 → Coin (strict >)', () => {
  assert.equal(pickCNFTType(500_000n, 0, false), CNFTImageType.Coin)
})

test('pickCNFTType: votes between 100_001 and 500_000 → Coin', () => {
  assert.equal(pickCNFTType(100_001n, 0, false), CNFTImageType.Coin)
  assert.equal(pickCNFTType(250_000n, 0, false), CNFTImageType.Coin)
})

test('pickCNFTType: votes exactly 100_000 → falls through to referrals/Common', () => {
  assert.equal(pickCNFTType(100_000n, 0, false), CNFTImageType.Common)
  assert.equal(pickCNFTType(100_000n, 1, false), CNFTImageType.Knight)
})

// pickCNFTType — Knight via referrals

test('pickCNFTType: referrals > 0 with low votes → Knight', () => {
  assert.equal(pickCNFTType(0n, 1, false), CNFTImageType.Knight)
  assert.equal(pickCNFTType(50_000n, 5, false), CNFTImageType.Knight)
})

test('pickCNFTType: high votes outrank Knight', () => {
  // Whale vote tier wins over referrals
  assert.equal(pickCNFTType(2_000_000n, 100, false), CNFTImageType.Whale)
  assert.equal(pickCNFTType(600_000n, 100, false), CNFTImageType.Diamond)
  assert.equal(pickCNFTType(150_000n, 100, false), CNFTImageType.Coin)
})

// pickCNFTType — Common fall-through

test('pickCNFTType: zero everything → Common', () => {
  assert.equal(pickCNFTType(0n, 0, false), CNFTImageType.Common)
})

test('pickCNFTType: low votes and zero referrals → Common', () => {
  assert.equal(pickCNFTType(99_999n, 0, false), CNFTImageType.Common)
})

test('pickCNFTType: negative referrals do not promote to Knight', () => {
  assert.equal(pickCNFTType(0n, -1, false), CNFTImageType.Common)
})

// pickNextColor — rotation modulo palette length (11 colors)

test('pickNextColor: undefined latest → first color (0)', () => {
  assert.equal(pickNextColor(undefined), 0)
})

test('pickNextColor: increments and wraps at the palette length', () => {
  // palette has 11 colors (indices 0–10)
  for (let i = 0; i < 10; i++) {
    assert.equal(pickNextColor(i), i + 1)
  }
  // wraparound: latest=10 → next is (10+1) % 11 = 0
  assert.equal(pickNextColor(10), 0)
})

test('pickNextColor: -1 sentinel rolls to 0 (matches addCNFT default)', () => {
  assert.equal(pickNextColor(-1), 0)
})

test('pickNextColor: matches cnftHexColor input convention', () => {
  // Round-trip: pick a next color, look up its hex — should always succeed
  for (let latest = -1; latest < 12; latest++) {
    const next = pickNextColor(latest)
    const hex = cnftHexColor(next)
    assert.match(hex, /^#[0-9A-F]{6}$/)
  }
})

// buildCNFTHelpers.addCNFT — the heavier branchy path

const ADDRESS_RAW = 'EQAvDfWFG0oYX19jwNDNBBL1rKNT9XfaGP9HyTb5nb2Eml6y'

function parseAddress() {
  return Address.parse(ADDRESS_RAW)
}

function stubDeps(
  overrides: Partial<CNFTHelperDependencies> = {},
): CNFTHelperDependencies {
  return {
    findByUserId: async () => null,
    findByWallet: async () => null,
    findLatest: async () => null,
    findLatestByType: async () => null,
    createCNFT: async (input) =>
      input as unknown as Awaited<ReturnType<CNFTHelperDependencies['createCNFT']>>,
    ...overrides,
  }
}

test('addCNFT throws when the user already owns a CNFT', async () => {
  const { addCNFT } = buildCNFTHelpers(stubDeps({
    findByUserId: async () => ({ index: 17 } as ExistingCNFTRef),
  }))

  await assert.rejects(
    () => addCNFT(1001, parseAddress(), 0n, 0, false, false),
    /\(17\) User 1001 already exists/,
  )
})

test('addCNFT throws when the wallet is already minted to a different user', async () => {
  const { addCNFT } = buildCNFTHelpers(stubDeps({
    findByWallet: async () => ({ index: 42 } as ExistingCNFTRef),
  }))

  await assert.rejects(
    () => addCNFT(1001, parseAddress(), 0n, 0, false, false),
    /\(42\) Wallet .* already exists/,
  )
})

test('addCNFT assigns next index from the latest CNFT', async () => {
  const created: CNFTCreateInput[] = []
  const { addCNFT } = buildCNFTHelpers(stubDeps({
    findLatest: async () => ({ index: 99 }),
    createCNFT: async (input) => {
      created.push(input)
      return input as unknown as Awaited<
        ReturnType<CNFTHelperDependencies['createCNFT']>
      >
    },
  }))

  await addCNFT(1001, parseAddress(), 0n, 0, false, false)

  assert.equal(created.length, 1)
  assert.equal(created[0].index, 100)
})

test('addCNFT assigns index 0 when no prior CNFT exists', async () => {
  const created: CNFTCreateInput[] = []
  const { addCNFT } = buildCNFTHelpers(stubDeps({
    findLatest: async () => null,
    createCNFT: async (input) => {
      created.push(input)
      return input as unknown as Awaited<
        ReturnType<CNFTHelperDependencies['createCNFT']>
      >
    },
  }))

  await addCNFT(1001, parseAddress(), 0n, 0, false, false)

  assert.equal(created[0].index, 0)
})

test('addCNFT picks CNFT type from votes/referrals/diceWinner', async () => {
  const created: CNFTCreateInput[] = []
  const { addCNFT } = buildCNFTHelpers(stubDeps({
    createCNFT: async (input) => {
      created.push(input)
      return input as unknown as Awaited<
        ReturnType<CNFTHelperDependencies['createCNFT']>
      >
    },
  }))

  await addCNFT(1, parseAddress(), 2_000_000n, 0, false, false)
  await addCNFT(2, parseAddress(), 0n, 5, false, false)
  await addCNFT(3, parseAddress(), 0n, 0, false, true)
  await addCNFT(4, parseAddress(), 0n, 0, false, false)

  assert.equal(created[0].type, CNFTImageType.Whale)
  assert.equal(created[1].type, CNFTImageType.Knight)
  assert.equal(created[2].type, CNFTImageType.Dice)
  assert.equal(created[3].type, CNFTImageType.Common)
})

test('addCNFT increments color from the latest CNFT of the same type', async () => {
  const created: CNFTCreateInput[] = []
  const { addCNFT } = buildCNFTHelpers(stubDeps({
    findLatestByType: async (type) => {
      if (type === CNFTImageType.Knight) return { color: 4 }
      return null
    },
    createCNFT: async (input) => {
      created.push(input)
      return input as unknown as Awaited<
        ReturnType<CNFTHelperDependencies['createCNFT']>
      >
    },
  }))

  await addCNFT(1, parseAddress(), 0n, 1, false, false)
  await addCNFT(2, parseAddress(), 0n, 0, false, false)

  assert.equal(created[0].color, 5)
  assert.equal(created[1].color, 0)
})

test('addCNFT forwards all fields and uses the non-bounceable wallet form', async () => {
  const created: CNFTCreateInput[] = []
  const address = parseAddress()
  const { addCNFT } = buildCNFTHelpers(stubDeps({
    createCNFT: async (input) => {
      created.push(input)
      return input as unknown as Awaited<
        ReturnType<CNFTHelperDependencies['createCNFT']>
      >
    },
  }))

  await addCNFT(1001, address, 750_000n, 3, true, false)

  assert.equal(created[0].userId, 1001)
  assert.equal(created[0].wallet, address.toString({ bounceable: false }))
  assert.equal(created[0].votes, 750_000n)
  assert.equal(created[0].referrals, 3)
  assert.equal(created[0].minted, true)
  assert.equal(created[0].diceWinner, false)
  // votes > 500_000 → Diamond
  assert.equal(created[0].type, CNFTImageType.Diamond)
})
