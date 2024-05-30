import { ConnectedWallet } from "@tonconnect/ui";
import { defineStore } from "pinia";
import { ref, Ref } from "vue";

export const useUserStore = defineStore("userStore", () => {
  const wallet: Ref<ConnectedWallet | undefined> = ref(undefined);

  function setWallet(value: ConnectedWallet | undefined) {
    wallet.value = value;
  }

  return { wallet, setWallet };
});
