// Founder = an existing Cube Worlds CNFT holder. We key off User.minted (set
// when their CNFT is minted to COLLECTION_ADDRESS). Kept pure + narrow so the
// rule can later be swapped for an on-chain ownership check without touching
// production callers.
export interface FounderInput {
  minted?: boolean
}

export function isFounder(user: FounderInput): boolean {
  return user.minted === true
}
