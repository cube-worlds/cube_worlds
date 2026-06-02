/* eslint-disable test/no-import-node-test */
import assert from 'node:assert/strict'
import test from 'node:test'
import { ClientError } from '#root/common/errors'
import { applyDebit } from '#root/common/models/WalletBalance'

test('applyDebit returns the new balance when the atomic decrement succeeds', async () => {
  const result = await applyDebit(7, 500_000n, async (userId, amount) => {
    assert.equal(userId, 7)
    assert.equal(amount, 500_000n)
    return 1_500_000n // remaining balance after decrement
  })
  assert.equal(result, 1_500_000n)
})

test('applyDebit throws ClientError when funds are insufficient (CAS returns null)', async () => {
  await assert.rejects(
    () => applyDebit(7, 9_000_000n, async () => null),
    (err) => err instanceof ClientError,
  )
})
