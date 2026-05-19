/* eslint-disable test/no-import-node-test */
import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { test } from 'node:test'
import { Address, toNano } from '@ton/core'
import { createMintBody } from '#root/common/helpers/nft-mint-body'

// Deterministic raw-form address (workchain 0, all-zero hash) — bypasses friendly-form checksum
const OWNER = Address.parseRaw(`0:${'00'.repeat(32)}`)

function makeParams(overrides: Partial<{
  queryId: number
  itemIndex: number
  amount: bigint
  commonContentUrl: string
}> = {}) {
  return {
    queryId: 1,
    itemOwnerAddress: OWNER,
    itemIndex: 42,
    amount: toNano('0.05'),
    commonContentUrl: 'metadata.json',
    ...overrides,
  }
}

// The body layout must round-trip through a parser:
// header: u32 opcode, u64 queryId, u64 itemIndex, coins amount
// ref: [address owner, ref: buffer(commonContentUrl)]

test('createMintBody header encodes the deploy opcode 1, queryId, itemIndex, and amount', () => {
  const cell = createMintBody(makeParams({ queryId: 7, itemIndex: 99, amount: toNano('0.026') }))
  const slice = cell.beginParse()

  assert.equal(slice.loadUint(32), 1, 'opcode is 1 (deploy)')
  assert.equal(slice.loadUint(64), 7, 'queryId is forwarded verbatim')
  assert.equal(slice.loadUint(64), 99, 'itemIndex is forwarded verbatim')
  assert.equal(slice.loadCoins(), toNano('0.026'), 'amount is encoded as coins (varint)')
})

test('createMintBody coerces queryId=0 via the `|| 0` fallback', () => {
  // 0 || 0 === 0 — this is the same value but exercises the fallback branch
  const cell = createMintBody(makeParams({ queryId: 0 }))
  const slice = cell.beginParse()
  slice.loadUint(32) // opcode
  assert.equal(slice.loadUint(64), 0)
})

test('createMintBody attaches an nftItemContent ref containing [owner address, content-url ref]', () => {
  const cell = createMintBody(makeParams({ commonContentUrl: 'foo.json' }))
  const slice = cell.beginParse()

  slice.loadUint(32) // opcode
  slice.loadUint(64) // queryId
  slice.loadUint(64) // itemIndex
  slice.loadCoins()  // amount

  const itemContent = slice.loadRef().beginParse()
  const owner = itemContent.loadAddress()
  assert.equal(owner.toString({ bounceable: false }), OWNER.toString({ bounceable: false }))

  const uri = itemContent.loadRef().beginParse()
  const uriBytes = uri.loadBuffer(uri.remainingBits / 8)
  assert.equal(uriBytes.toString('utf8'), 'foo.json')
})

test('createMintBody UTF-8 encodes the commonContentUrl as raw bytes', () => {
  const cell = createMintBody(makeParams({ commonContentUrl: 'ipfs://QmHash/meta.json' }))
  const slice = cell.beginParse()

  slice.loadUint(32) // opcode
  slice.loadUint(64) // queryId
  slice.loadUint(64) // itemIndex
  slice.loadCoins()  // amount

  const itemContent = slice.loadRef().beginParse()
  itemContent.loadAddress()
  const uri = itemContent.loadRef().beginParse()
  const uriBytes = uri.loadBuffer(uri.remainingBits / 8)
  assert.deepEqual([...uriBytes], [...Buffer.from('ipfs://QmHash/meta.json', 'utf8')])
})

test('createMintBody produces a deterministic, identical cell for identical inputs', () => {
  const a = createMintBody(makeParams())
  const b = createMintBody(makeParams())
  // Cells implement structural equality via .hash()
  assert.equal(a.hash().toString('hex'), b.hash().toString('hex'))
})

test('createMintBody produces a different cell when itemIndex changes', () => {
  const a = createMintBody(makeParams({ itemIndex: 1 }))
  const b = createMintBody(makeParams({ itemIndex: 2 }))
  assert.notEqual(a.hash().toString('hex'), b.hash().toString('hex'))
})
