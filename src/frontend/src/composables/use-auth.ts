import { ref } from "vue";
import { authenticateUser } from "../services/auth-service";

export const useAuth = (initData: string, userId: number, referId: number | undefined) => {
  const user = ref();
  const error = ref();

  const login = async () => {
    try {
      // const userString = sessionStorage.getItem("user");
      // if (userString) {
      //   const userModel = JSON.parse(userString);
      //   user.value = userModel;
      //   return;
      // }
      const userModel = await authenticateUser(initData, userId, referId);
      user.value = userModel;
      sessionStorage.setItem("user", JSON.stringify(userModel));
      return true
    } catch (error_) {
      error.value = error_
      return false
    }
  };

  return {
    user,
    error,
    login,
  };
};
