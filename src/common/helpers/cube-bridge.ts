// Pure withdraw-eligibility + fee math for the $CUBE on-chain bridge. DB
// User.votes stays canonical; these helpers gate the DB→chain direction.
export const WITHDRAW_COOLDOWN_MS = 24 * 60 * 60 * 1000
export const WITHDRAW_FEE_BPS = 200 // 2%

export interface WithdrawCheck {
  ok: boolean
  msRemaining: number
}

export function canWithdraw(
  lastWithdrawAt: Date | null,
  now: Date = new Date(),
): WithdrawCheck {
  if (!lastWithdrawAt) return { ok: true, msRemaining: 0 }
  const elapsed = now.getTime() - lastWithdrawAt.getTime()
  const remaining = WITHDRAW_COOLDOWN_MS - elapsed
  return remaining <= 0
    ? { ok: true, msRemaining: 0 }
    : { ok: false, msRemaining: remaining }
}

export interface FeeSplit {
  fee: bigint
  net: bigint
}

export function applyWithdrawFee(amount: bigint): FeeSplit {
  if (amount <= 0n) throw new Error('Withdraw amount must be positive')
  const fee = (amount * BigInt(WITHDRAW_FEE_BPS)) / 10_000n
  return { fee, net: amount - fee }
}
