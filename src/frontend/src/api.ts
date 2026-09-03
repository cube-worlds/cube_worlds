// Typed fetch wrappers for the Cube Worlds API. Every authenticated endpoint
// takes Telegram's signed initData string in the POST body.

import { getInitData } from './telegram'

// Non-2xx responses still carry our `{ error, code }` envelope (400/403/409/
// 502 from the pass and wallet routes, 429 from the rate limiter). Only a
// non-JSON body is a transport failure.
async function post<T>(url: string, body: Record<string, unknown> = {}): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ initData: getInitData(), ...body }),
  })
  const json = await response.json().catch(() => null)
  if (json === null) throw new Error(`HTTP ${response.status}`)
  return json as T
}

export interface ApiError {
  error?: string
  code?: string
}

export interface Pass {
  index: number
  address: string
  name: string
  image: string
}

export interface LoginResponse extends ApiError {
  id: number
  language: string
  wallet?: string
  referalId?: number
  balance: string
  minted: boolean
  mintState: string
  holder: boolean
  pass: Pass | null
  username: string | null
}

export function login(referId?: string): Promise<LoginResponse> {
  return post('/api/auth/login', referId ? { referId } : {})
}

export interface PublicConfig {
  botName: string
  donationAddress: string
  collectionAddress: string
  generationTryCostVotes: number
  referralMintRewardVotes: number
  starsTopupVotesPerStar: number
}

export async function publicConfig(): Promise<PublicConfig> {
  const response = await fetch('/api/public/config')
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return response.json() as Promise<PublicConfig>
}

export interface MintStatus extends ApiError {
  state: string
  minted: boolean
  nftUrl?: string
  tryCost: string
  yourVotes: string
  canAfford: boolean
  hasWallet: boolean
  avatar: string | null
  image: string | null
  description?: string
  canGenerate: boolean
}

export function mintStatus(): Promise<MintStatus> {
  return post('/api/mint/status')
}

export interface GenerateResponse extends ApiError {
  image: string | null
  description: string
  yourVotes: string
  tryCost?: string
}

export function generate(): Promise<GenerateResponse> {
  return post('/api/mint/generate')
}

export interface SubmitResponse extends ApiError {
  ok?: boolean
  state?: string
}

export function submitDraft(): Promise<SubmitResponse> {
  return post('/api/mint/submit')
}

export interface AvatarPhoto {
  index: number
  dataUrl: string
}

export interface AvatarsResponse extends ApiError {
  photos: AvatarPhoto[]
}

export function listAvatars(): Promise<AvatarsResponse> {
  return post('/api/mint/avatars')
}

export interface AvatarResponse extends ApiError {
  avatar: string | null
}

export function selectAvatar(index: number): Promise<AvatarResponse> {
  return post('/api/mint/avatar/select', { index })
}

export async function uploadAvatar(file: File): Promise<AvatarResponse> {
  const form = new FormData()
  form.append('initData', getInitData())
  form.append('file', file)
  const response = await fetch('/api/mint/avatar/upload', {
    method: 'POST',
    body: form,
  })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return response.json() as Promise<AvatarResponse>
}

export interface ClaimStatus extends ApiError {
  canClaim: boolean
  hasNeverClaimed: boolean
  streakDays: number
  claimMultiplier: number
  rawClaimAmount: number
  progressPercent: number
  secondsUntilClaim: number
}

export function claimStatus(): Promise<ClaimStatus> {
  return post('/api/users/claim/status')
}

export interface ClaimResponse extends ClaimStatus {
  claimedAmount: number
  balance: string
  message: string
}

export function claimDaily(): Promise<ClaimResponse> {
  return post('/api/users/claim')
}

export interface TopupInvoiceResponse extends ApiError {
  link: string
  votes: string
  stars: number
}

export function topupInvoice(stars: number): Promise<TopupInvoiceResponse> {
  return post('/api/users/topup/invoice', { stars })
}

export interface WalletNonceResponse extends ApiError {
  payload: string
  validUntil: number
}

export function walletNonce(): Promise<WalletNonceResponse> {
  return post('/api/auth/wallet-nonce')
}

export interface SetWalletBody {
  address: string
  publicKey: string
  walletStateInit: string
  proof: {
    timestamp: number
    domain: { lengthBytes: number, value: string }
    payload: string
    signature: string
  }
}

export interface SetWalletResponse extends ApiError {
  ok?: boolean
  wallet?: string
}

export function setWallet(body: SetWalletBody): Promise<SetWalletResponse> {
  return post('/api/auth/set-wallet', { ...body })
}

export interface ScanResponse extends ApiError {
  passes: Pass[]
}

export function scanPasses(): Promise<ScanResponse> {
  return post('/api/pass/scan')
}

export function selectPass(index: number): Promise<LoginResponse> {
  return post('/api/pass/select', { index })
}
