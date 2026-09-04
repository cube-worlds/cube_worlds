// Shape shared by POST /api/auth/login and POST /api/pass/select so the
// webview can replace its user object from either response.

// Public IPFS gateways rate-limit (429) browsers hard, so NFT images are
// served through our own cache-proxy (`GET /api/pass/image/*`) instead of a
// gateway URL. Also rewrites gateway URLs already stored in `User.pass`.
const IPFS_URI = /^(?:ipfs:\/\/|https?:\/\/[^/]+\/ipfs\/)(.+)$/

export const PASS_IMAGE_PREFIX = '/api/pass/image/'

export function passImageUrl(uri: string | undefined): string {
  if (!uri) return ''
  const match = IPFS_URI.exec(uri)
  return match ? `${PASS_IMAGE_PREFIX}${match[1]}` : uri
}

// Inverse of passImageUrl, for prefetching what the webview is about to load.
export function passImageCidPath(url: string | undefined): string | null {
  return url?.startsWith(PASS_IMAGE_PREFIX)
    ? url.slice(PASS_IMAGE_PREFIX.length)
    : null
}

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
        image: passImageUrl(user.pass.image),
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
