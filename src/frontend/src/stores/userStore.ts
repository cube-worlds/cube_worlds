import { ConnectedWallet } from "@tonconnect/ui";
import { defineStore } from "pinia";
import { ref, Ref } from "vue";

export interface UserStore {
  id: number;
  language: string;
  wallet: string;
  referalId: number | undefined;
  balance: number | undefined;
}

export const useUserStore = defineStore("userStore", () => {
  const wallet: Ref<ConnectedWallet | undefined> = ref();
  const user: Ref<UserStore | undefined> = ref();

  function setWallet(value: ConnectedWallet | undefined) {
    wallet.value = value;
  }

  function setUser(value: UserStore) {
    user.value = value;
  }

  return { wallet, setWallet, user, setUser };
})
