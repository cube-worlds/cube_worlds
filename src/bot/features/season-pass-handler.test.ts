/* eslint-disable test/no-import-node-test */
import type { SeasonPassHandlerDependencies } from '#root/bot/features/season-pass-handler'
import assert from 'node:assert/strict'
import test from 'node:test'
import { buildSeasonPassHandlers, parseSeasonPassPayload } from '#root/bot/features/season-pass-handler'
import { RewardsEntryType } from '#root/common/models/RewardsPoolLedger'

function makeDeps(overrides: Partial<SeasonPassHandlerDependencies> = {}) {
  const calls = { granted: [] as any[], accruals: [] as any[] }
  const deps: SeasonPassHandlerDependencies = {
    parsePayload: parseSeasonPassPayload,
    grantSeasonPass: async (i) => { calls.granted.push(i) },
    accrueRewards: async (e) => { calls.accruals.push(e) },
    accrueShare: micro => micro / 5n,
    seasonPassRevenueMicro: () => 1_800_000n,
    accrualType: RewardsEntryType.AccrualSeasonPass,
    logError: () => {},
    ...overrides,
  }
  return { deps, calls }
}

test('parseSeasonPassPayload extracts a positive id, rejects garbage', () => {
  assert.equal(parseSeasonPassPayload('seasonpass:7'), 7)
  assert.equal(parseSeasonPassPayload('seasonpass:0'), null)
  assert.equal(parseSeasonPassPayload('seasonpass:-1'), null)
  assert.equal(parseSeasonPassPayload('other:7'), null)
  assert.equal(parseSeasonPassPayload('seasonpass:abc'), null)
})

test('pre-checkout approves a valid payload and rejects an invalid one', async () => {
  const { deps } = makeDeps()
  const h = buildSeasonPassHandlers(deps)
  assert.deepEqual(await h.handlePreCheckout('seasonpass:7'), { ok: true })
  const bad = await h.handlePreCheckout('nope')
  assert.equal(bad.ok, false)
  assert.ok(bad.error)
})

test('successful payment grants the pass with Telegram expiry and accrues revenue', async () => {
  const { deps, calls } = makeDeps()
  const h = buildSeasonPassHandlers(deps)
  const expSec = 1_780_000_000
  const text = await h.handleSuccessfulPayment({
    telegramPaymentChargeId: 'charge_1',
    invoicePayload: 'seasonpass:7',
    subscriptionExpirationDate: expSec,
  })
  assert.ok(text && text.includes('Season Pass'))
  assert.equal(calls.granted[0].userId, 7)
  assert.equal(calls.granted[0].telegramPaymentChargeId, 'charge_1')
  assert.equal((calls.granted[0].activeUntil as Date).getTime(), expSec * 1000)
  assert.equal(calls.accruals[0].amount, 360_000n) // 20% of 1.8 USDT
  assert.equal(calls.accruals[0].externalId, 'accrual:sp:charge_1')
})

test('successful payment with a bad payload does nothing and returns null', async () => {
  const { deps, calls } = makeDeps()
  const h = buildSeasonPassHandlers(deps)
  const text = await h.handleSuccessfulPayment({ telegramPaymentChargeId: 'c', invoicePayload: 'bad' })
  assert.equal(text, null)
  assert.equal(calls.granted.length, 0)
})

test('a failed accrual does not block the grant', async () => {
  const { deps, calls } = makeDeps({ accrueRewards: async () => { throw new Error('boom') } })
  const h = buildSeasonPassHandlers(deps)
  const text = await h.handleSuccessfulPayment({ telegramPaymentChargeId: 'c2', invoicePayload: 'seasonpass:7' })
  assert.ok(text)
  assert.equal(calls.granted.length, 1)
})
