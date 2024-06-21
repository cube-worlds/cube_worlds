import axios from "axios";

export const authenticateUser = async (initData: string, userId: number) => {
  try {
    const response = await axios.post(`/api/auth/${userId}`, { initData });
    return response.data;
  } catch (error) {
    console.error('Error authenticating user:', error);
    throw error;
  }
};