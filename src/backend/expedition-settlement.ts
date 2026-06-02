import type { Commitment } from '#root/common/helpers/congestion'
import { settleWorld } from '#root/common/helpers/congestion'
import { randomFloat } from '#root/common/helpers/random'
import { currentTickId } from '#root/common/helpers/tick'
import { BalanceChangeType } from '#root/common/models/Balance'
import {
  claimCredit,
  findSettledUncredited,
  findUnsettledForWorld,
  settleExpedition,
} from '#root/common/models/Expedition'
import { addPoints } from '#root/common/models/User'
import {
  findUnsettledWorlds,
  markWorldSettled,
} from '#root/common/models/World'
import { logger } from '#root/logger'

interface SettlementWorld {
  tickId: number
  worldId: string
  cubePool: number
}

interface SettlementExpedition {
  _id: unknown
  userId: number
  worldId: string
  weight: number
  risk: Commitment['risk']
}

export interface SettlementDependencies {
  currentTickId: () => number
  findUnsettledWorlds: (currentTickId: number) => Promise<SettlementWorld[]>
  findUnsettledForWorld: (tickId: number, worldId: string) => Promise<SettlementExpedition[]>
  rollRisk: () => number
  settleExpedition: (expeditionId: unknown, award: number) => Promise<boolean>
  markWorldSettled: (tickId: number, worldId: string) => Promise<void>
  findSettledUncredited: () => Promise<Array<{ _id: unknown, userId: number, cubeAwarded: number }>>
  claimCredit: (expeditionId: unknown) => Promise<boolean>
  addPoints: (userId: number, add: bigint, reason: BalanceChangeType) => Promise<bigint>
  logInfo: (message: string) => void
  logError: (message: string) => void
}

function createDefaultDependencies(): SettlementDependencies {
  return {
    currentTickId: () => currentTickId(),
    findUnsettledWorlds: async (tick) =>
      (await findUnsettledWorlds(tick)) as unknown as SettlementWorld[],
    findUnsettledForWorld: async (tickId, worldId) =>
      (await findUnsettledForWorld(tickId, worldId)) as unknown as SettlementExpedition[],
    rollRisk: () => randomFloat(),
    settleExpedition,
    markWorldSettled,
    findSettledUncredited: async () =>
      (await findSettledUncredited()) as unknown as Array<{ _id: unknown, userId: number, cubeAwarded: number }>,
    claimCredit,
    addPoints,
    logInfo: logger.info.bind(logger),
    logError: logger.error.bind(logger),
  }
}

export function buildSettlementRunner(
  deps: SettlementDependencies = createDefaultDependencies(),
) {
  async function settlePass(): Promise<void> {
    const tick = deps.currentTickId()
    const worlds = await deps.findUnsettledWorlds(tick)
    for (const world of worlds) {
      const expeditions = await deps.findUnsettledForWorld(world.tickId, world.worldId)
      const commitments: Commitment[] = expeditions.map((e) => ({
        expeditionId: String(e._id),
        weight: e.weight,
        risk: e.risk,
        riskRoll: deps.rollRisk(),
      }))
      const awards = settleWorld(world.cubePool, commitments)
      const awardById = new Map(awards.map((a) => [a.expeditionId, a.award]))
      for (const e of expeditions) {
        const award = awardById.get(String(e._id)) ?? 0
        await deps.settleExpedition(e._id, award)
      }
      await deps.markWorldSettled(world.tickId, world.worldId)
    }
    if (worlds.length > 0) {
      deps.logInfo(`Settlement: settled ${worlds.length} world(s) for ticks < ${tick}`)
    }
  }

  // Second pass: credit balances for any settled-but-uncredited expedition.
  // claimCredit's CAS guarantees exactly one runner credits each row.
  //
  // Ordering is deliberate: claimCredit flips credited=true BEFORE addPoints
  // runs. A crash in the gap therefore loses this expedition's CUBE (it stays
  // credited=true, never re-selected) rather than risking a double-pay on the
  // next run. For a soft-currency faucet that bias (prefer under-pay) is the
  // safe one; the reconciliation worker in Plan 2 is the mechanism that
  // detects and replays any such gap. Revisit before any hard-currency use.
  async function creditPass(): Promise<void> {
    const pending = await deps.findSettledUncredited()
    for (const e of pending) {
      const won = await deps.claimCredit(e._id)
      if (!won) continue
      if (e.cubeAwarded > 0) {
        try {
          await deps.addPoints(e.userId, BigInt(e.cubeAwarded), BalanceChangeType.Expedition)
        } catch (err) {
          deps.logError(`Settlement credit failed for ${e.userId}: ${(err as Error).message}`)
        }
      }
    }
  }

  async function runOnce(): Promise<void> {
    await settlePass()
    await creditPass()
  }

  return { runOnce }
}

const settlementRunner = buildSettlementRunner()

export default settlementRunner
