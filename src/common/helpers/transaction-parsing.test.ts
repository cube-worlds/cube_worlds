/* eslint-disable test/no-import-node-test */
import type { Transaction } from '@ton/core'
import assert from 'node:assert/strict'
import test from 'node:test'
import { Address, beginCell, Cell, toNano } from '@ton/core'
import { parseInternalInMessage } from '#root/common/helpers/transaction-parsing'

const SAMPLE_ADDRESS = Address.parse(
  '0QC4sEG_VQ4QawHnr77mqJhC98cpoyI-0gXuwR76Ff2kT4eI',
)

interface MockInternalInMessage {
  info: {
    type: 'internal'
    src: Address
    value: { coins: bigint }
  }
  body: Cell
}

function makeTextCommentBody(text: string): Cell {
  return beginCell().storeUint(0, 32).storeStringTail(text).endCell()
}

function makeTransaction(inMessage: unknown): Transaction {
  return { inMessage } as unknown as Transaction
}

function makeInternalInMessage(
  body: Cell,
  value: bigint = toNano('1'),
  src: Address = SAMPLE_ADDRESS,
): MockInternalInMessage {
  return {
    info: { type: 'internal', src, value: { coins: value } },
    body,
  }
}

test('parseInternalInMessage returns null when inMessage is missing', () => {
  assert.equal(parseInternalInMessage(makeTransaction(undefined)), null)
  assert.equal(parseInternalInMessage(makeTransaction(null)), null)
})

test('parseInternalInMessage returns null for non-internal messages', () => {
  const externalIn = {
    info: { type: 'external-in' },
    body: new Cell(),
  }
  assert.equal(parseInternalInMessage(makeTransaction(externalIn)), null)
})

test('parseInternalInMessage extracts source, value, and text comment', () => {
  const body = makeTextCommentBody('s:1909767')
  const tx = makeTransaction(
    makeInternalInMessage(body, toNano('0.1'), SAMPLE_ADDRESS),
  )

  const parsed = parseInternalInMessage(tx)

  assert.ok(parsed)
  assert.equal(parsed.source.toString(), SAMPLE_ADDRESS.toString())
  assert.equal(parsed.value, toNano('0.1'))
  assert.equal(parsed.text, 's:1909767')
})

test('parseInternalInMessage handles empty body (no text comment)', () => {
  const body = new Cell() // 0 bits, 0 refs
  const tx = makeTransaction(makeInternalInMessage(body))

  const parsed = parseInternalInMessage(tx)

  assert.ok(parsed)
  assert.equal(parsed.text, undefined)
})

test('parseInternalInMessage skips text when first 32 bits are non-zero (op != 0)', () => {
  const body = beginCell().storeUint(0xf8a7ea5, 32).storeUint(0, 64).endCell()
  const tx = makeTransaction(makeInternalInMessage(body))

  const parsed = parseInternalInMessage(tx)

  assert.ok(parsed)
  assert.equal(parsed.text, undefined)
})

test('parseInternalInMessage skips text when body is shorter than 32 bits', () => {
  const body = beginCell().storeUint(7, 8).endCell() // only 8 bits
  const tx = makeTransaction(makeInternalInMessage(body))

  const parsed = parseInternalInMessage(tx)

  assert.ok(parsed)
  assert.equal(parsed.text, undefined)
})

test('parseInternalInMessage handles plain text comments (donation flow)', () => {
  const body = makeTextCommentBody('https://t.me/tnfaucet_bot - test giver')
  const tx = makeTransaction(
    makeInternalInMessage(body, toNano('0.01'), SAMPLE_ADDRESS),
  )

  const parsed = parseInternalInMessage(tx)

  assert.ok(parsed)
  assert.equal(parsed.text, 'https://t.me/tnfaucet_bot - test giver')
})

test('parseInternalInMessage preserves the raw bigint value (no precision loss)', () => {
  const exotic = 123_456_789_012_345_678n
  const body = makeTextCommentBody('test')
  const tx = makeTransaction(makeInternalInMessage(body, exotic))

  const parsed = parseInternalInMessage(tx)

  assert.ok(parsed)
  assert.equal(parsed.value, exotic)
})

test('parseInternalInMessage swallows body-parsing errors and returns text=undefined', () => {
  // A body that throws when iterated as a slice exercises the try/catch fallback
  // around the text-comment decode path.
  const exploding = {
    beginParse: () => {
      throw new Error('boom')
    },
  } as unknown as Cell
  const tx = makeTransaction(makeInternalInMessage(exploding))

  const parsed = parseInternalInMessage(tx)

  assert.ok(parsed)
  assert.equal(parsed.text, undefined)
  assert.equal(parsed.value, toNano('1'))
})
