/* eslint-disable test/no-import-node-test */
import type { Context } from 'grammy'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { voteScore } from '#root/common/helpers/votes'

function makeCtx(isPremium: boolean | undefined): Context {
  return {
    getAuthor: async () => ({
      user: { is_premium: isPremium },
    }),
  } as unknown as Context
}

test('voteScore returns 1000 for premium users', async () => {
  assert.equal(await voteScore(makeCtx(true)), 1000)
})

test('voteScore returns 100 for non-premium users', async () => {
  assert.equal(await voteScore(makeCtx(false)), 100)
})

test('voteScore treats missing is_premium as non-premium (defaults to 100)', async () => {
  assert.equal(await voteScore(makeCtx(undefined)), 100)
})
