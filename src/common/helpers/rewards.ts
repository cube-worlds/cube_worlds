// The rewards pool is a fixed basis-point share of net revenue (the 20%
// invariant). All amounts are bigint micro-USDT.
export const REWARDS_POOL_BPS = 2000n

export function accrueShare(
  amountMicro: bigint,
  bps: bigint = REWARDS_POOL_BPS,
): bigint {
  if (amountMicro <= 0n)
    return 0n
  return (amountMicro * bps) / 10_000n
}
