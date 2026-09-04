// Shape shared by POST /api/auth/login and POST /api/pass/select so the
// webview can replace its user object from either response.

export interface Pass {
  index: number
  address: string
  name: string
  image: string
  // Internal: item content JSON (ipfs://…) used to fetch traits. Never sent to clients.
  contentUri?: string
  traits?: Record<string, number>
}

export interface PassSnapshot extends Pass {
  verifiedAt: Date
}

export interface LoginUser {
  id: number
  language: string
  wallet?: string
  referalId?: number
  votes: bigint
  minted: boolean
  state: string
  pass?: PassSnapshot
}

export function loginPayload(user: LoginUser, username: string | null) {
  const pass: Pass | null = user.pass
    ? {
        index: user.pass.index,
        address: user.pass.address,
        name: user.pass.name,
        image: user.pass.image,
      }
    : null
  return {
    id: user.id,
    language: user.language,
    wallet: user.wallet,
    referalId: user.referalId,
    balance: user.votes.toString(),
    minted: user.minted,
    mintState: user.state,
    holder: pass !== null,
    pass,
    username,
  }
}
