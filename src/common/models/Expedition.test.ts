/* eslint-disable test/no-import-node-test */
import assert from 'node:assert/strict'
import test from 'node:test'
import { commitmentWeight } from '#root/common/models/Expedition'

test('commitmentWeight adds the CUBE-boost weight to energy spent', () => {
  // base energy 30, no boost
  assert.equal(commitmentWeight(30, 0), 30)
  // 600 CUBE boost / 100 CUBE-per-weight = +6 weight
  assert.equal(commitmentWeight(30, 600), 36)
  // sub-threshold boost rounds down
  assert.equal(commitmentWeight(30, 150), 31)
})
