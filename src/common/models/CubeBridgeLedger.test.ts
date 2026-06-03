/* eslint-disable test/no-import-node-test */
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  CubeBridgeEntryType,
  CubeBridgeStatus,
  getCubeBridgeTypeName,
} from '#root/common/models/CubeBridgeLedger'

test('entry types cover deposit + withdraw', () => {
  assert.equal(getCubeBridgeTypeName(CubeBridgeEntryType.Deposit), 'Deposit')
  assert.equal(getCubeBridgeTypeName(CubeBridgeEntryType.Withdraw), 'Withdraw')
  assert.equal(getCubeBridgeTypeName(-1 as CubeBridgeEntryType), 'Unknown')
})

test('statuses are the three rail states', () => {
  assert.deepEqual(
    Object.values(CubeBridgeStatus).sort(),
    ['completed', 'failed', 'pending'],
  )
})
