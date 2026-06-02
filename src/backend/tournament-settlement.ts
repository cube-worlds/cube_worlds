import { splitPrizePool } from '#root/common/helpers/tournament'

// Pure weekly tournament settlement runner, modeled on expedition-settlement.ts
// (two passes, idempotent) and wallet-reconciliation.ts (xRocket via an injected
// dep). It has NO config-touching default — the composer
// (tournament-settlement-runner.ts) supplies every dependency, so nothing a test
// imports reaches #root/config.

export interface SettlementEntry {
  _id: unknown
  userId: number
  weekId: number
  payoutMicro: bigint
}

export interface TournamentSettlementDependencies {
  currentWeekId: () => number
  findUnsettledTournaments: (currentWeekId: number) => Promise<Array<{ weekId: number }>>
  findEntries: (weekId: number) => Promise<Array<{ _id: unknown, userId: number }>>
  // CUBE earned from expeditions during the week, per entrant.
  scoreForWeek: (weekId: number, userIds: number[]) => Promise<Map<number, bigint>>
  // Whether an entrant is eligible to receive a real-money payout (anti-Sybil).
  payoutEligible: (userId: number) => Promise<boolean>
  setEntryResult: (entryId: unknown, r: { scoreCube: bigint, rank: number, payoutMicro: bigint }) => Promise<void>
  markTournamentSettled: (weekId: number, prizePoolMicro: bigint) => Promise<boolean>
  poolBalance: () => Promise<bigint>
  findUnpaidWinners: () => Promise<SettlementEntry[]>
  claimPayout: (entryId: unknown) => Promise<boolean>
  recordPayout: (e: { weekId: number, userId: number, amount: bigint }) => Promise<void>
  payUser: (tgUserId: number, amountUsdt: number, payoutId: string) => Promise<void>
  microToUsdt: (micro: bigint) => number
  areWithdrawalsPaused: () => Promise<boolean>
  logInfo: (message: string) => void
  logError: (message: string) => void
}

export function buildTournamentSettlementRunner(deps: TournamentSettlementDependencies) {
  // Pass 1: rank each closed-week's entrants by score, snapshot the pool, and
  // write per-entry payouts. Compute + persist results BEFORE marking settled so
  // a crash in the gap can't strand a settled week with zeroed payouts.
  async function settlePass(): Promise<void> {
    const week = deps.currentWeekId()
    const tournaments = await deps.findUnsettledTournaments(week)
    for (const t of tournaments) {
      const entries = await deps.findEntries(t.weekId)
      if (entries.length === 0) {
        await deps.markTournamentSettled(t.weekId, 0n)
        continue
      }
      const scores = await deps.scoreForWeek(t.weekId, entries.map(e => e.userId))
      // Stable rank: score desc, ties broken by lower userId for determinism.
      const ranked = [...entries].sort((a, b) => {
        const sa = scores.get(a.userId) ?? 0n
        const sb = scores.get(b.userId) ?? 0n
        return sa === sb ? a.userId - b.userId : (sb > sa ? 1 : -1)
      })

      const pool = await deps.poolBalance()
      // Payouts go to the eligible entrants only, in ranked order — an ineligible
      // entrant is still ranked for display but earns 0, and the whole pool is
      // distributed across the eligible field (splitPrizePool renormalizes).
      const eligibility = await Promise.all(ranked.map(e => deps.payoutEligible(e.userId)))
      const eligible = ranked.filter((_, i) => eligibility[i])
      const payouts = splitPrizePool(pool, eligible.length)
      const payoutByEntry = new Map<unknown, bigint>()
      eligible.forEach((e, i) => payoutByEntry.set(e._id, payouts[i] ?? 0n))

      for (let i = 0; i < ranked.length; i++) {
        const e = ranked[i]
        await deps.setEntryResult(e._id, {
          scoreCube: scores.get(e.userId) ?? 0n,
          rank: i + 1,
          payoutMicro: payoutByEntry.get(e._id) ?? 0n,
        })
      }
      await deps.markTournamentSettled(t.weekId, pool)
      deps.logInfo(`Tournament: settled week ${t.weekId} (${ranked.length} entrant(s), pool ${deps.microToUsdt(pool)} USDT)`)
    }
  }

  // Pass 2: pay each settled-but-unpaid winner. claimPayout's CAS guarantees
  // exactly one runner pays each entry. Order: claim -> record the pool debit
  // (idempotent ledger row, the durable audit trail) -> transfer. If the
  // transfer throws, the entry stays paid with a recorded debit + a logged
  // error; the operator replays via the multi-cheque fallback. Prefer
  // not-double-paying over guaranteed-paid — same bias as the Plan-1 credit pass.
  async function payoutPass(): Promise<void> {
    if (await deps.areWithdrawalsPaused()) {
      deps.logError('Tournament payouts skipped: withdrawals are paused (reconciliation divergence)')
      return
    }
    const winners = await deps.findUnpaidWinners()
    for (const e of winners) {
      if (e.payoutMicro <= 0n)
        continue
      const won = await deps.claimPayout(e._id)
      if (!won)
        continue
      await deps.recordPayout({ weekId: e.weekId, userId: e.userId, amount: e.payoutMicro })
      try {
        await deps.payUser(e.userId, deps.microToUsdt(e.payoutMicro), `payout:${e.weekId}:${e.userId}`)
      }
      catch (err) {
        deps.logError(`Tournament payout transfer failed for ${e.userId} (week ${e.weekId}): ${(err as Error).message}`)
      }
    }
  }

  async function runOnce(): Promise<void> {
    await settlePass()
    await payoutPass()
  }

  return { runOnce }
}
