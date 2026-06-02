/* eslint-disable test/no-import-node-test */
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getResourceChangeTypeName,
  ResourceChangeType,
  ResourceKind,
} from '#root/common/models/ResourceLedger'

test('ResourceKind enumerates the four resources', () => {
  assert.deepEqual(
    Object.values(ResourceKind).sort(),
    ['food', 'gold', 'iron', 'mana'],
  )
})

test('getResourceChangeTypeName maps known + unknown values', () => {
  assert.equal(getResourceChangeTypeName(ResourceChangeType.Production), 'Production')
  assert.equal(getResourceChangeTypeName(ResourceChangeType.Upgrade), 'Upgrade')
  assert.equal(getResourceChangeTypeName(-999 as ResourceChangeType), 'Unknown')
})
