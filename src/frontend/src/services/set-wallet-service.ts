import axios from 'axios'

export async function postUserWallet(initData: string, wallet: string) {
  try {
    const response = await axios.post(`/api/auth/set-wallet`, {
      initData,
      wallet,
    })
    return response.data
  } catch (error) {
    console.error('Error set wallet for user:', error)
    throw error
  }
}
