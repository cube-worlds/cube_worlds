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
    ip: string
}

export const useUserStore = defineStore('userStore', () => {
    const wallet: Ref<ConnectedWallet | undefined> = ref()
    const user: Ref<UserStore | undefined> = ref()
    const balance = ref<bigint | null>(null)

    function setWallet(value: ConnectedWallet | undefined) {
        wallet.value = value
    }

    function setUser(value: UserStore) {
        user.value = value
        setBalance(value.balance)
    }

    function setBalance(value: string | bigint | undefined) {
        if (value === undefined)
            return
        balance.value = BigInt(value)
    }

    return { wallet, setWallet, user, setUser, balance, setBalance }
})
