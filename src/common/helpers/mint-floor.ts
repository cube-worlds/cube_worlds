// Escalating NFT-mint eligibility floor. PURE — no config import, so it loads
// under NODE_ENV=test. The floor rises with the number of NFTs already minted,
// so the queue clears in votes order while each new slot costs more: donate TON
// → votes to clear it. votes are bigint throughout.

export interface MintFloorParams {
  base: bigint
  step: bigint
  cap: bigint
}

// Linear escalating floor: min(base + step·n, cap), where n = minted count.
// Non-decreasing in n and clamped at cap. Negative/fractional counts are
// floored to a safe non-negative integer.
export function mintFloorVotes(
  mintedCount: number,
  params: MintFloorParams,
): bigint {
  const n = mintedCount > 0 ? BigInt(Math.floor(mintedCount)) : 0n
  const linear = params.base + params.step * n
  return linear > params.cap ? params.cap : linear
}

// A user is eligible to mint once their votes reach the current floor.
export function isMintEligible(
  votes: bigint,
  mintedCount: number,
  params: MintFloorParams,
): boolean {
  return votes >= mintFloorVotes(mintedCount, params)
}
