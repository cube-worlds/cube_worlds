<template>
  <div class="trade-page">
    <div class="card">
      <h1>Exchange $CUBE to $SATOSHI</h1>

      <div v-if="userBalanceNum < minUserBalance" class="warn">
        Your balance is below {{ minUserBalance }} $CUBE — exchange unavailable
      </div>

      <div v-else class="slider-block">
        <div class="slider-container">
          <input
            type="range"
            :min="minUserBalance"
            :max="userBalanceNum"
            step="1"
            v-model.number="selectedAmount"
            class="fancy-slider"
          />
        </div>
        <div class="slider-values">
          <span>{{ formattedSelectedAmount }} $CUBE</span>
        </div>
      </div>

      <div class="stat">
        <span>You'll receive</span>
        <span class="amount-value">≈ {{ formattedSatoshiReceived }} $SATOSHI</span>
      </div>

      <div class="actions">
        <button :disabled="actionDisabled" @click="doChange" class="trade-button">
          {{ sending ? "Sending..." : "Exchange Now" }}
        </button>
      </div>

      <div v-if="txResult" class="tx-result">{{ txResult }}</div>
      <div v-if="error" class="error">{{ error }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, inject, onMounted } from "vue"
import TonWeb from "tonweb"
import type { TonConnectUI } from "@tonconnect/ui"
import { useUserStore } from "../stores/userStore"
import { commaSeparatedNumber } from "#root/common/helpers/numbers.ts"

const tonConnectUI = inject("tonConnectUI") as { value: TonConnectUI | null } | undefined
const userStore = useUserStore()

const minUserBalance = 1000

const retryFetch = async (url: string, retries = 5, delay = 500) => {
  for (let i = 0; i < retries; i++) {
    try {
      const r = await fetch(url)
      if (r.ok) return r
    } catch (_) {}
    await new Promise(res => setTimeout(res, delay))
  }
  throw new Error("Fetch failed after retries: " + url)
}

function toNumberSafe(v: any) {
  const n = Number(v ?? 0)
  return Number.isNaN(n) ? 0 : n
}

const userBalanceRaw = computed(() => userStore.balance ?? 0)
const userBalanceNum = computed(() => Math.floor(toNumberSafe(userBalanceRaw.value)))

const selectedAmount = ref(
  Math.max(minUserBalance, userBalanceNum.value > 0 ? Math.min(userBalanceNum.value, minUserBalance) : minUserBalance)
)

const sumAll = ref<number | null>(null)
const commonSatoshiRaw = ref<number | null>(null)

const sending = ref(false)
const txResult = ref<string | null>(null)
const error = ref<string | null>(null)

const satoshiReceived = computed(() => {
  if (sumAll.value == null || commonSatoshiRaw.value == null) return null
  if (!selectedAmount.value || sumAll.value === 0) return null
  const res = (selectedAmount.value / sumAll.value) * commonSatoshiRaw.value
  return Math.floor(isFinite(res) ? res : 0)
})

const formattedSelectedAmount = computed(() =>
  commaSeparatedNumber(selectedAmount.value)
)

const formattedSatoshiReceived = computed(() =>
  satoshiReceived.value === null ? "…" : commaSeparatedNumber(satoshiReceived.value)
)

const actionDisabled = computed(() => {
  if (userBalanceNum.value < minUserBalance) return true
  if (selectedAmount.value < minUserBalance) return true
  if (!tonConnectUI || !tonConnectUI.value) return true
  return sending.value
})

const SUM_API = "/api/trade/balances"

const isDev = import.meta.env.VITE_ENV === "development"
console.log(isDev ? "Development mode" : "Production mode")

const rpcAddress = isDev ? "https://testnet.toncenter.com/api/v2/jsonRPC" : "https://toncenter.com/api/v2/jsonRPC"
const provider = new TonWeb.HttpProvider(rpcAddress)
const tonweb = new TonWeb(provider)

const cubeAddress = isDev
  ? "0QC4sEG_VQ4QawHnr77mqJhC98cpoyI-0gXuwR76Ff2kT4eI"
  : "UQDSqdhnwMllRlp0EqB4asBQiGhNWNa-9S4hPSVONLfr0WF3"

const satoshiWalletAddress = isDev
  ? "kQDnOgk7w_OC29bZgkSel0DRpXL8yv8M1EqhtIhjO0wWps1u"
  : "EQCd7tILlcnS89uI0OD4Zzz7yQHGLhGzBedk88PKGEbmv7zP"

async function fetchSumAll() {
  try {
    const r = await retryFetch(SUM_API)
    const json = await r.json()
    sumAll.value = toNumberSafe(json.sum)
  } catch {
    sumAll.value = null
    error.value = "Failed to fetch total CUBE supply"
  }
}

async function fetchSatoshiWalletBalance(maxRetries = 10, retryDelay = 1000) {
  let retries = 0
  while (retries <= maxRetries) {
    try {
      const result = await tonweb.provider.call2(satoshiWalletAddress, "get_wallet_data")
      commonSatoshiRaw.value = toNumberSafe(
        TonWeb.utils.fromNano(String(result[0] ?? 0))
      )
    } catch (e) {
      retries++;
      if (retries > maxRetries) {
        console.error('Error getting jetton data after maximum retries:', e)
        commonSatoshiRaw.value = null
        return
      }
      console.warn(`Jetton data fetch attempt ${retries} failed, retrying in ${retryDelay}ms...`)
      await new Promise((resolve) => setTimeout(resolve, retryDelay))
      retryDelay *= 2
    }
  }
}

onMounted(async () => {
  await Promise.all([fetchSumAll(), fetchSatoshiWalletBalance()])

  if (userBalanceNum.value >= minUserBalance) {
    selectedAmount.value = Math.min(
      userBalanceNum.value,
      Math.max(minUserBalance, Math.floor(userBalanceNum.value / 2))
    )
  }
})

async function doChange() {
  error.value = null
  txResult.value = null

  const ui = tonConnectUI?.value ?? null
  if (!ui) {
    error.value = "Wallet UI not found"
    return
  }

  const wallet = ui.wallet
  if (!wallet) {
    ui.openModal()
    return
  }

  sending.value = true
  try {
    const cell = new TonWeb.boc.Cell()
    cell.bits.writeUint(0, 32)
    cell.bits.writeString(String(selectedAmount.value))

    const payload = btoa(
      String.fromCharCode(...new Uint8Array(await cell.toBoc()))
    )

    await ui.sendTransaction({
      validUntil: Math.floor(Date.now() / 1000) + 120,
      messages: [
        {
          address: cubeAddress,
          amount: "100000000",
          payload,
        },
      ],
    })

    txResult.value = "Transaction sent"
  } catch (e: any) {
    error.value = e?.message ?? "Failed to send transaction"
  } finally {
    sending.value = false
  }
}
</script>

<style scoped>
.trade-page {
  padding: 12px;
  width: 100%;
  max-width: 500px;
  margin: 0 auto;
}

.card {
  background: rgba(0, 0, 40, 0.7);
  border-radius: 12px;
  padding: 14px;
  margin-bottom: 12px;
  backdrop-filter: blur(4px);
  border: 1px solid rgba(255, 255, 255, 0.06);
}

.warn {
  color: #ffb3b3;
  padding: 10px 12px;
  background: rgba(255, 100, 100, 0.08);
  border-radius: 10px;
  margin-bottom: 12px;
  font-size: 13px;
  border: 1px solid rgba(255, 100, 100, 0.2);
}

.slider-block {
  padding: 16px 0;
}

.slider-container {
  margin-bottom: 12px;
}

.fancy-slider {
  width: 100%;
  height: 6px;
  border-radius: 10px;
  background: linear-gradient(90deg, rgba(78, 140, 255, 0.2), rgba(78, 140, 255, 0.4));
  outline: none;
  -webkit-appearance: none;
  appearance: none;
  cursor: pointer;
}

.fancy-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: #4e8cff;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(78, 140, 255, 0.4);
  transition: all 0.2s ease;
}

.fancy-slider::-webkit-slider-thumb:active {
  transform: scale(1.15);
  box-shadow: 0 4px 12px rgba(78, 140, 255, 0.6);
}

.fancy-slider::-moz-range-thumb {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: #4e8cff;
  cursor: pointer;
  border: none;
  box-shadow: 0 2px 8px rgba(78, 140, 255, 0.4);
  transition: all 0.2s ease;
}

.fancy-slider::-moz-range-thumb:active {
  transform: scale(1.15);
  box-shadow: 0 4px 12px rgba(78, 140, 255, 0.6);
}

.slider-values {
  display: flex;
  justify-content: flex-start;
  font-size: 13px;
  opacity: 0.8;
  padding: 0 4px;
  color: #9cc2ff;
}

.stat {
  display: flex;
  justify-content: space-between;
  padding: 12px 0;
  color: #fff;
  font-size: 14px;
}

.amount-value {
  color: #4e8cff;
  font-weight: 600;
}

.actions {
  margin: 16px 0;
}

.trade-button {
  width: 100%;
  padding: 12px;
  border-radius: 12px;
  border: none;
  background: #4e8cff;
  color: #fff;
  font-size: 17px;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.2s ease;
}

.trade-button:hover:not(:disabled) {
  background: #6ba3ff;
}

.trade-button:active:not(:disabled) {
  transform: scale(0.98);
}

.trade-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.tx-result {
  margin-top: 10px;
  padding: 10px 12px;
  background: rgba(100, 200, 100, 0.08);
  color: #b3ffb3;
  border-radius: 10px;
  font-size: 13px;
  text-align: center;
  border: 1px solid rgba(100, 200, 100, 0.2);
}

.error {
  margin-top: 10px;
  padding: 10px 12px;
  background: rgba(255, 100, 100, 0.08);
  color: #ffb3b3;
  border-radius: 10px;
  font-size: 13px;
  text-align: center;
  border: 1px solid rgba(255, 100, 100, 0.2);
}
</style>
