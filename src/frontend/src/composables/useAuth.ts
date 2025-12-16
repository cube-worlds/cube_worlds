import { authenticateUser } from '../services/auth-service'
import { useUserStore } from '../stores/userStore'

export function useAuth(initData: string, referId: number | undefined) {
    const login = async () => {
        // const userString = sessionStorage.getItem("user");
        // if (userString) {
        //   const userModel = JSON.parse(userString);
        //   user.value = userModel;
        //   return;
        // }
        const userStore = useUserStore()
        const userModel = await authenticateUser(initData, referId)
        userStore.setUser(initData, userModel)
        // sessionStorage.setItem('user', JSON.stringify(userModel))
        return userModel
    }

    return {
        login,
    }
}
