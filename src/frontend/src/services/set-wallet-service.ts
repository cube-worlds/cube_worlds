import type { TonProofItemReplySuccess } from '@tonconnect/ui'
import axios from 'axios'

interface NonceResponse {
  payload: string
  validUntil: number
}

export async function fetchWalletNonce(initData: string): Promise<NonceResponse> {
  const response = await axios.post('/api/auth/wallet-nonce', { initData })
  if (response.data?.error) {
    throw new Error(`Failed to fetch wallet nonce: ${response.data.error}`)
  }
  return response.data as NonceResponse
}

interface SetWalletArgs {
  initData: string
  address: string
  publicKey: string
  walletStateInit: string
  proof: TonProofItemReplySuccess['proof']
}

export async function postUserWallet(args: SetWalletArgs) {
  try {
    const response = await axios.post('/api/auth/set-wallet', args)
    return response.data
  } catch (error) {
    console.error('Error set wallet for user:', error)
    throw error
  }
}
