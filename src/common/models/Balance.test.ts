/* eslint-disable test/no-import-node-test */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  BalanceChangeType,
  getBalanceChangeTypeName,
} from '#root/common/models/Balance'

// every enum value round-trips to its key

test('getBalanceChangeTypeName resolves each defined enum value to its key', () => {
  assert.equal(getBalanceChangeTypeName(BalanceChangeType.Unknown), 'Unknown')
  assert.equal(getBalanceChangeTypeName(BalanceChangeType.Initial), 'Initial')
  assert.equal(getBalanceChangeTypeName(BalanceChangeType.Deposit), 'Deposit')
  assert.equal(getBalanceChangeTypeName(BalanceChangeType.Withdraw), 'Withdraw')
  assert.equal(getBalanceChangeTypeName(BalanceChangeType.Dice), 'Dice')
  assert.equal(getBalanceChangeTypeName(BalanceChangeType.Referral), 'Referral')
  assert.equal(getBalanceChangeTypeName(BalanceChangeType.Donation), 'Donation')
  assert.equal(getBalanceChangeTypeName(BalanceChangeType.Task), 'Task')
  assert.equal(getBalanceChangeTypeName(BalanceChangeType.Claim), 'Claim')
  assert.equal(getBalanceChangeTypeName(BalanceChangeType.Trade), 'Trade')
})

// numeric values map to the right keys (defends against accidental enum reordering)

test('getBalanceChangeTypeName accepts raw numeric values', () => {
  assert.equal(getBalanceChangeTypeName(-1), 'Unknown')
  assert.equal(getBalanceChangeTypeName(0), 'Initial')
  assert.equal(getBalanceChangeTypeName(7), 'Claim')
  assert.equal(getBalanceChangeTypeName(8), 'Trade')
})

// out-of-range values fall back to 'Unknown'

test('getBalanceChangeTypeName falls back to Unknown for missing values', () => {
  assert.equal(getBalanceChangeTypeName(999 as BalanceChangeType), 'Unknown')
  assert.equal(getBalanceChangeTypeName(-2 as BalanceChangeType), 'Unknown')
})

test('getBalanceChangeTypeName maps the expedition-loop types', () => {
  assert.equal(getBalanceChangeTypeName(BalanceChangeType.Expedition), 'Expedition')
  assert.equal(getBalanceChangeTypeName(BalanceChangeType.Spend), 'Spend')
})

test('getBalanceChangeTypeName maps the castle and pvp types', () => {
  assert.equal(getBalanceChangeTypeName(BalanceChangeType.CastleUpgrade), 'CastleUpgrade')
  assert.equal(getBalanceChangeTypeName(BalanceChangeType.Recruit), 'Recruit')
  assert.equal(getBalanceChangeTypeName(BalanceChangeType.ArenaEntry), 'ArenaEntry')
  assert.equal(getBalanceChangeTypeName(BalanceChangeType.RaidStake), 'RaidStake')
})
