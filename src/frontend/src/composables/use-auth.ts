import { ref } from "vue";
import { authenticateUser } from "../services/auth-service";
import { unknown } from "zod";

export const useAuth = (initData: string, userId: number) => {
  const user = ref();
  const error = ref();

  const login = async () => {
    try {
      const userString = sessionStorage.getItem("user");
      if (userString) {
        const userModel = JSON.parse(userString);
        user.value = userModel;
        return;
      }
      const userModel = await authenticateUser(initData, userId);
      user.value = userModel;
      sessionStorage.setItem("user", JSON.stringify(userModel));
    } catch (error_) {
      error.value = error_
    }
  };

  return {
    user,
    error,
    login,
  };
};
