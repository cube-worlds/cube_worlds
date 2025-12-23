import axios from 'axios'

export async function authenticateUser(
  initData: string,
  referId: number | undefined,
) {
  try {
    const response = await axios.post(`/api/auth/login`, { initData, referId })
    return response.data
  } catch (error) {
    console.error('Error authenticating user:', error)
    throw error
  }
}
