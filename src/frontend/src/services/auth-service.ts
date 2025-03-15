import axios from 'axios'

export async function authenticateUser(initData: string, userId: number, referId: number | undefined) {
  try {
    const response = await axios.post(`/api/auth/${userId}`, { initData, referId })
    return response.data
  }
  catch (error) {
    console.error('Error authenticating user:', error)
    throw error
  }
}
