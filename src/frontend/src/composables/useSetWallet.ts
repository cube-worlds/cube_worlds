import type { TonConnectUI, TonProofItemReply, TonProofItemReplySuccess } from '@tonconnect/ui'
import type { Ref } from 'vue'
import { inject, watch } from 'vue'
import { fetchWalletNonce, postUserWallet } from '../services/set-wallet-service'
import { useUserStore } from '../stores/userStore'

function isProofSuccess(reply: TonProofItemReply | undefined): reply is TonProofItemReplySuccess {
  return !!reply && 'proof' in reply
}

async function refreshNonce(tonConnectUI: TonConnectUI, initData: string) {
  try {
    tonConnectUI.setConnectRequestParameters({ state: 'loading' })
    const { payload } = await fetchWalletNonce(initData)
    tonConnectUI.setConnectRequestParameters({
      state: 'ready',
      value: { tonProof: payload },
    })
  } catch (error) {
    console.error('Failed to prepare wallet proof nonce:', error)
    // Drop the loader so the modal doesn't get stuck — wallet will fall back
    // to a plain ton_addr connect, which the backend will reject.
    tonConnectUI.setConnectRequestParameters(null)
  }
}

export function useSetWallet() {
  const userStore = useUserStore()
  const tonConnectUIRef = inject<Ref<TonConnectUI | null>>('tonConnectUI')

  // Once we have both initData (login finished) and a TonConnect UI instance,
  // pre-stage a proof nonce so the next connect collects ton_proof.
  watch(
    () => [userStore.initData, tonConnectUIRef?.value] as const,
    ([initData, tc]) => {
      if (!initData || !tc) return
      void refreshNonce(tc, initData)
    },
    { immediate: true },
  )

  watch(
    () => userStore.wallet,
    async (wallet) => {
      if (!wallet) return
      const initData = userStore.initData
      if (!initData) {
        console.error('Init data not available, cannot set wallet')
        return
      }

      const proofReply = wallet.connectItems?.tonProof
      if (!isProofSuccess(proofReply)) {
        // Session restore (or ton_proof unsupported by this wallet). No fresh
        // signature, so we can't prove ownership; backend rejects bindings
        // without proof. User must disconnect and reconnect to bind.
        console.warn(
          'Wallet connected without ton_proof — binding skipped. Disconnect and reconnect to bind.',
        )
        return
      }

      const { address, publicKey, walletStateInit } = wallet.account
      if (!publicKey || !walletStateInit) {
        console.error('Wallet account is missing publicKey or walletStateInit')
        return
      }

      try {
        const response = await postUserWallet({
          initData,
          address,
          publicKey,
          walletStateInit,
          proof: proofReply.proof,
        })
        console.error('Wallet set successfully:', response)
      } catch (error) {
        console.error(
          `Failed to set wallet: ${(error as Error)?.message ?? error}`,
        )
      } finally {
        // Rotate the nonce so a subsequent reconnect gets a fresh challenge.
        if (tonConnectUIRef?.value) {
          void refreshNonce(tonConnectUIRef.value, initData)
        }
      }
    },
  )
}
