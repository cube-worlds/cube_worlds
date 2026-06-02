/* eslint-disable test/no-import-node-test */
import type { DocumentType } from '@typegoose/typegoose'
import type { Energy } from '#root/common/models/Energy'
import assert from 'node:assert/strict'
import test from 'node:test'
import { ClientError } from '#root/common/errors'
import { ENERGY_MAX } from '#root/common/helpers/energy'
import { getEnergyStatus, spendEnergy } from '#root/common/models/Energy'

function fakeEnergy(current: number, regenAt: Date): DocumentType<Energy> {
  return { current, regenAt } as unknown as DocumentType<Energy>
}

test('getEnergyStatus reports the lazily-regenerated balance', () => {
  const status = getEnergyStatus(fakeEnergy(50, new Date(0)), new Date(18 * 60 * 1000))
  assert.equal(status.current, 53)
  assert.equal(status.max, ENERGY_MAX)
})

test('spendEnergy deducts and persists when affordable', async () => {
  const energy = fakeEnergy(100, new Date(0))
  const writes: Array<{ current: number }> = []
  const result = await spendEnergy(energy, 30, new Date(0), async (_e, _prev, update) => {
    writes.push({ current: update.current })
    return true
  })
  assert.equal(result.current, 70)
  assert.equal(writes[0].current, 70)
  assert.equal(energy.current, 70) // in-memory doc updated on success
})

test('spendEnergy regenerates before checking affordability', async () => {
  // 20 energy + 18 minutes (=+3) = 23, enough for a 22 spend
  const energy = fakeEnergy(20, new Date(0))
  const result = await spendEnergy(energy, 22, new Date(18 * 60 * 1000), async () => true)
  assert.equal(result.current, 1)
})

test('spendEnergy throws ClientError when unaffordable', async () => {
  const energy = fakeEnergy(10, new Date(0))
  await assert.rejects(
    () => spendEnergy(energy, 30, new Date(0), async () => true),
    (err) => err instanceof ClientError,
  )
})

test('spendEnergy throws when it loses the compare-and-swap race', async () => {
  const energy = fakeEnergy(100, new Date(0))
  await assert.rejects(
    () => spendEnergy(energy, 30, new Date(0), async () => false),
    (err) => err instanceof ClientError,
  )
})
