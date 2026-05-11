/* eslint-disable test/no-import-node-test */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { appendOwnRowIfMissing } from '#root/common/helpers/leaderboard-rows'

test('appendOwnRowIfMissing returns the body unchanged when the user is in the top-N', async () => {
  const body = [['1', 'alice', '100']]
  let buildCalls = 0
  const result = await appendOwnRowIfMissing({
    body,
    topN: [{ name: 'alice' }],
    ownMatches: (v) => v.name === 'alice',
    buildOwnRow: () => { buildCalls += 1; return ['x', 'y', 'z'] },
  })
  assert.equal(result, body)
  assert.equal(buildCalls, 0)
})

test('appendOwnRowIfMissing appends the user row when missing from the top-N', async () => {
  const body = [['1', 'alice', '100'], ['2', 'bob', '50']]
  const result = await appendOwnRowIfMissing({
    body,
    topN: [{ name: 'alice' }, { name: 'bob' }],
    ownMatches: (v) => v.name === 'carol',
    buildOwnRow: () => ['42', 'carol', '5'],
  })
  assert.deepEqual(result, [
    ['1', 'alice', '100'],
    ['2', 'bob', '50'],
    ['...', '...', '...'],
    ['42', 'carol', '5'],
  ])
})

test('appendOwnRowIfMissing returns body unchanged when buildOwnRow returns null', async () => {
  const body = [['1', 'alice', '100']]
  const result = await appendOwnRowIfMissing({
    body,
    topN: [{ name: 'alice' }],
    ownMatches: (v) => v.name === 'carol',
    buildOwnRow: () => null,
  })
  assert.deepEqual(result, body)
})

test('appendOwnRowIfMissing awaits an async buildOwnRow', async () => {
  const body = [['1', 'alice', '100']]
  const result = await appendOwnRowIfMissing({
    body,
    topN: [{ name: 'alice' }],
    ownMatches: (v) => v.name === 'carol',
    buildOwnRow: async () => {
      await Promise.resolve()
      return ['7', 'carol', '3']
    },
  })
  assert.deepEqual(result[result.length - 1], ['7', 'carol', '3'])
})

test('appendOwnRowIfMissing does not mutate the input body', async () => {
  const body = [['1', 'alice', '100']]
  const before = JSON.stringify(body)
  await appendOwnRowIfMissing({
    body,
    topN: [{ name: 'alice' }],
    ownMatches: (v) => v.name === 'carol',
    buildOwnRow: () => ['7', 'carol', '3'],
  })
  assert.equal(JSON.stringify(body), before)
})
