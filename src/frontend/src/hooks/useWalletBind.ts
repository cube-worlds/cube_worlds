import type { SetWalletResponse } from '../api'
import { useTonConnectUI } from '@tonconnect/ui-react'
import { useCallback, useEffect, useRef } from 'react'
import { setWallet, walletNonce } from '../api'

// Cryptographic wallet binding (TON Connect ton_proof):
// nonce → setConnectRequestParameters({ tonProof }) → wallet modal → the
// wallet signs the proof → POST /api/auth/set-wallet verifies and binds.
export function useWalletBind(
  onBound: (address: string) => void,
  onError?: (result: SetWalletResponse) => void,
) {
  const [tonConnectUI] = useTonConnectUI()
  const onBoundRef = useRef(onBound)
  onBoundRef.current = onBound
  const onErrorRef = useRef(onError)
  onErrorRef.current = onError

  useEffect(() => {
    const unsubscribe = tonConnectUI.onStatusChange((wallet) => {
      if (!wallet) return
      const tonProof = wallet.connectItems?.tonProof
      if (!tonProof || !('proof' in tonProof)) return
      const { account } = wallet
      if (!account.publicKey || !account.walletStateInit) return
      void setWallet({
        address: account.address,
        publicKey: account.publicKey,
        walletStateInit: account.walletStateInit,
        proof: tonProof.proof,
      })
        .then((result) => {
          if (!result.error && result.wallet) onBoundRef.current(result.wallet)
          else onErrorRef.current?.(result)
        })
        .catch(() => onErrorRef.current?.({ error: 'Network error' }))
    })
    return unsubscribe
  }, [tonConnectUI])

  const bindWallet = useCallback(async () => {
    // Each rebind needs a fresh nonce, and the proof is only produced during
    // connect — drop any stale session first.
    if (tonConnectUI.connected) await tonConnectUI.disconnect()
    tonConnectUI.setConnectRequestParameters({ state: 'loading' })
    try {
      const nonce = await walletNonce()
      if (nonce.error || !nonce.payload) throw new Error(nonce.error)
      tonConnectUI.setConnectRequestParameters({
        state: 'ready',
        value: { tonProof: nonce.payload },
      })
      await tonConnectUI.openModal()
    } catch {
      tonConnectUI.setConnectRequestParameters(null)
      onErrorRef.current?.({ error: 'Could not start wallet connect' })
    }
  }, [tonConnectUI])

  return { bindWallet, tonConnectUI }
}
