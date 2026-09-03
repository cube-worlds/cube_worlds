// Read snapshot of the fields the approve/decline transitions need. Decoupled
// from the Mongoose doc so the transition logic is pure + unit-testable.
export interface ApprovalUser {
  id: number
  name?: string
  wallet?: string
  votes: bigint
  minted: boolean
  image?: string
  nftDescription?: string
}

export interface QueueApprovalDependencies {
  // Atomic CAS into the minting guard. Returns true only for the first caller;
  // a concurrent / repeat approve loses and gets false (single-mint guarantee).
  claimForMint: (userId: number) => Promise<boolean>
  // Release the guard so the admin can retry — ONLY safe before the on-chain
  // mint has happened (no NFT delivered yet).
  releaseClaim: (userId: number) => Promise<void>
  pinToIpfs: (
    user: ApprovalUser,
  ) => Promise<{ imageHash: string, jsonHash: string }>
  mintOnChain: (user: ApprovalUser, jsonHash: string) => Promise<string>
  markMinted: (
    userId: number,
    nftUrl: string,
    imageHash: string,
    jsonHash: string,
  ) => Promise<void>
  setRework: (userId: number) => Promise<void>
  notifyApproved: (user: ApprovalUser, nftUrl: string) => Promise<void>
  notifyDeclined: (user: ApprovalUser) => Promise<void>
  // Credit the inviter (if any) after the invitee's pass is minted. Runs at
  // most once per user (the CAS claim gates the whole approve path).
  rewardReferrer: (user: ApprovalUser) => Promise<void>
  logError: (message: string) => void
}

export type ApproveResult =
  | { ok: true, nftUrl: string }
  | { ok: false, reason: string }

export type DeclineResult =
  | { ok: true }
  | { ok: false, reason: string }

export function buildQueueApproval(deps: QueueApprovalDependencies) {
  // Approve = pin → mint on-chain → flip minted. Idempotent: the CAS claim
  // means the mint seam fires at most once even if Approve is pressed twice.
  async function approve(user: ApprovalUser): Promise<ApproveResult> {
    if (user.minted) return { ok: false, reason: 'already-minted' }
    if (!user.wallet) return { ok: false, reason: 'no-wallet' }
    if (!user.image || !user.nftDescription) {
      return { ok: false, reason: 'no-draft' }
    }

    // CAS-claim the mint. A second concurrent/repeat approve loses here, so the
    // expensive pin + on-chain mint runs exactly once.
    const claimed = await deps.claimForMint(user.id)
    if (!claimed) return { ok: false, reason: 'already-claimed' }

    let imageHash: string
    let jsonHash: string
    let nftUrl: string
    try {
      ;({ imageHash, jsonHash } = await deps.pinToIpfs(user))
      // Mint BEFORE flipping minted (operator-funded; bias a rare double-mint
      // on crash over silently dropping a paid mint). Mirrors castle/hero.
      nftUrl = await deps.mintOnChain(user, jsonHash)
    } catch (err) {
      // Pin/mint failed → nothing was delivered → safe to release for retry.
      deps.logError(
        `Approve mint failed for ${user.id}: ${(err as Error).message}`,
      )
      await deps.releaseClaim(user.id)
      return { ok: false, reason: 'mint-failed' }
    }

    // From here the NFT exists on-chain: NEVER release the claim. A markMinted
    // failure must bias to false-error (manual reconcile), never a double-mint.
    await deps.markMinted(user.id, nftUrl, imageHash, jsonHash)
    // Referral payout is a bonus — it must never fail an approved mint.
    try {
      await deps.rewardReferrer(user)
    } catch (err) {
      deps.logError(
        `Referral reward failed for ${user.id}: ${(err as Error).message}`,
      )
    }
    await deps.notifyApproved(user, nftUrl)
    return { ok: true, nftUrl }
  }

  // Decline = move the draft to Rework so the user can regenerate and resubmit.
  // Never mints, never touches the chain. Paid tries stay spent.
  async function decline(user: ApprovalUser): Promise<DeclineResult> {
    if (user.minted) return { ok: false, reason: 'already-minted' }
    await deps.setRework(user.id)
    await deps.notifyDeclined(user)
    return { ok: true }
  }

  return { approve, decline }
}
