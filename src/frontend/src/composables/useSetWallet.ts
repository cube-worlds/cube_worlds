import { watch } from 'vue'
import { postUserWallet } from '../services/set-wallet-service'
import { useUserStore } from '../stores/userStore'

export function useSetWallet() {
    const userStore = useUserStore()

    watch(
        () => userStore.wallet,
        async (wallet) => {
            console.error('Wallet changed:', wallet)
            if (!wallet) {
                return
            }
            if (!userStore.initData) {
                console.error('Init data not available, cannot set wallet')
                return
            }

            try {
                const walletAddress = wallet.account.address
                const response = await postUserWallet(userStore.initData, walletAddress)
                console.error('Wallet set successfully:', response)
            } catch (error) {
                console.error(`Failed to set wallet: ${(error as Error)?.message ?? error}`)
            }
        },
    )
}
