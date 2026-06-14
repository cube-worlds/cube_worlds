import type { ConnectedWallet } from '@tonconnect/ui'
import type { Ref } from 'vue'
import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface UserStore {
  id: number
  language: string
  wallet: string
  referalId: number | undefined
  balance: string | undefined
  // NFT-gated entry: owns an on-chain NFT? + the current mint lifecycle state.
  minted: boolean
  mintState: string
  ip: string
}

export const useUserStore = defineStore('userStore', () => {
  const wallet: Ref<ConnectedWallet | null> = ref(null)
  const user: Ref<UserStore | undefined> = ref()
  const balance = ref<bigint | null>(null)
  const initData = ref<string>('')

  function setWallet(value: ConnectedWallet | null) {
    wallet.value = value
  }

  function setUser(initDataValue: string, storeValue: UserStore) {
    initData.value = initDataValue
    user.value = storeValue
    setBalance(storeValue.balance)
  }

  function setBalance(value: string | bigint | undefined) {
    if (value === undefined) return
    balance.value = BigInt(value)
  }

  // Flip the gate open once the mint lands (status poll sees minted=true).
  function setMinted(value: boolean) {
    if (user.value) user.value.minted = value
  }

  return {
    wallet,
    setWallet,
    user,
    setUser,
    balance,
    setBalance,
    setMinted,
    initData,
  }
})
