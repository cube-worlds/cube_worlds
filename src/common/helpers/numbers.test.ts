/* eslint-disable test/no-import-node-test */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { commaSeparatedNumber, kFormatter } from '#root/common/helpers/numbers'

test('commaSeparatedNumber inserts thousands separators in numbers', () => {
  assert.equal(commaSeparatedNumber(0), '0')
  assert.equal(commaSeparatedNumber(123), '123')
  assert.equal(commaSeparatedNumber(1234), '1,234')
  assert.equal(commaSeparatedNumber(1234567), '1,234,567')
})

test('commaSeparatedNumber accepts bigint input', () => {
  assert.equal(commaSeparatedNumber(1_000_000_000_000n), '1,000,000,000,000')
  assert.equal(commaSeparatedNumber(0n), '0')
})

test('commaSeparatedNumber preserves negative sign and only groups the digits', () => {
  // -1234 → "-1,234" (regex looks for 3-digit boundary, sign sits on the left)
  assert.equal(commaSeparatedNumber(-1234), '-1,234')
})

test('kFormatter compacts numbers using en locale notation', () => {
  assert.equal(kFormatter(999), '999')
  assert.equal(kFormatter(1_000), '1K')
  assert.equal(kFormatter(1_500), '1.5K')
  assert.equal(kFormatter(1_000_000), '1M')
})

test('kFormatter accepts bigint input', () => {
  assert.equal(kFormatter(2_500n), '2.5K')
})
