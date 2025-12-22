<script setup lang="ts">
import type { TonConnectUI } from '@tonconnect/ui'
import { commaSeparatedNumber } from '#root/common/helpers/numbers.ts'
import TonWeb from 'tonweb'
import { computed, inject, onMounted, ref } from 'vue'
import { useRetry } from '../composables/useRetry'
import { useUserStore } from '../stores/userStore'

const tonConnectUI = inject('tonConnectUI') as { value: TonConnectUI | null } | undefined
const userStore = useUserStore()
const { retry } = useRetry()

const minUserBalance = 1000

function toNumberSafe(v: any) {
    const n = Number(v ?? 0)
    return Number.isNaN(n) ? 0 : n
}

const userBalanceNum = computed(() => Math.floor(toNumberSafe(userStore.balance)))
const selectedAmount = ref(minUserBalance)

const sumAll = ref<number | null>(null)
const commonSatoshiRaw = ref<number | null>(null)

const sending = ref(false)
const txResult = ref<string | null>(null)
const error = ref<string | null>(null)

const satoshiReceived = computed(() => {
    if (!sumAll.value || !commonSatoshiRaw.value)
        return null
    const r = (selectedAmount.value / sumAll.value) * commonSatoshiRaw.value
    return Math.floor(Number.isFinite(r) ? r : 0)
})

const formattedSelectedAmount = computed(() =>
    commaSeparatedNumber(selectedAmount.value),
)

const formattedSatoshiReceived = computed(() =>
    satoshiReceived.value === null ? '…' : commaSeparatedNumber(satoshiReceived.value),
)

const actionDisabled = computed(() => {
    if (!satoshiReceived.value || satoshiReceived.value < 1)
        return true
    if (userBalanceNum.value < minUserBalance)
        return true
    if (selectedAmount.value < minUserBalance)
        return true
    if (!tonConnectUI?.value)
        return true
    return sending.value
})

const SUM_API = '/api/users/balances'

const isDev = import.meta.env.VITE_ENV === 'development'
const rpcAddress = isDev
    ? 'https://testnet.toncenter.com/api/v2/jsonRPC'
    : 'https://toncenter.com/api/v2/jsonRPC'

const provider = new TonWeb.HttpProvider(rpcAddress)
const tonweb = new TonWeb(provider)

const cubeAddress = isDev
    ? '0QC4sEG_VQ4QawHnr77mqJhC98cpoyI-0gXuwR76Ff2kT4eI'
    : 'UQDSqdhnwMllRlp0EqB4asBQiGhNWNa-9S4hPSVONLfr0WF3'

const satoshiWalletAddress = isDev
    ? 'kQDnOgk7w_OC29bZgkSel0DRpXL8yv8M1EqhtIhjO0wWps1u'
    : 'EQCd7tILlcnS89uI0OD4Zzz7yQHGLhGzBedk88PKGEbmv7zP'

async function fetchSumAll() {
    const r = await retry(() => fetch(SUM_API))
    if (!r) {
        error.value = 'Failed to fetch total CUBE supply'
        sumAll.value = null
        return
    }
    const json = await r.json()
    sumAll.value = toNumberSafe(json.balances)
}

async function fetchSatoshiWalletBalance() {
    const res = await retry(() =>
        tonweb.provider.call2(satoshiWalletAddress, 'get_wallet_data'),
    )
    if (!res) {
        error.value = 'Failed to fetch total SATOSHI supply'
        commonSatoshiRaw.value = null
        return
    }
    commonSatoshiRaw.value = toNumberSafe(
        TonWeb.utils.fromNano(String(res[0] ?? 0)),
    )
}

onMounted(async () => {
    await Promise.all([fetchSumAll(), fetchSatoshiWalletBalance()])

    if (userBalanceNum.value >= minUserBalance) {
        selectedAmount.value = Math.min(
            userBalanceNum.value,
            Math.max(minUserBalance, Math.floor(userBalanceNum.value / 2)),
        )
    }
})

async function doChange() {
    error.value = null
    txResult.value = null

    const ui = tonConnectUI?.value
    if (!ui) {
        error.value = 'Wallet UI not found'
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
        cell.bits.writeString(`s:${String(selectedAmount.value)}`)

        const payload = btoa(
            String.fromCharCode(...new Uint8Array(await cell.toBoc())),
        )

        await ui.sendTransaction({
            validUntil: Math.floor(Date.now() / 1000) + 120,
            messages: [
                {
                    address: cubeAddress,
                    amount: '100000000',
                    payload,
                },
            ],
        })

        txResult.value = 'Transaction sent'
    } catch (e: any) {
        error.value = e?.message ?? 'Failed to send transaction'
    } finally {
        sending.value = false
    }
}
</script>

<template>
    <div class="trade-page">
        <div class="card">
            <!-- OVERLAY -->
            <div
                v-if="sending"
                class="overlay"
            >
                <div class="overlay-content">
                    <div class="spinner" />
                    <div class="overlay-title">
                        Transaction in progress
                    </div>
                    <div class="overlay-sub">
                        Confirm the operation in your wallet
                    </div>
                </div>
            </div>

            <h1>Exchange $CUBE to $SATOSHI</h1>

            <div
                v-if="userBalanceNum < minUserBalance"
                class="warn"
            >
                Your balance is below {{ minUserBalance }} $CUBE — exchange unavailable
            </div>

            <div
                v-else
                class="slider-block"
            >
                <div class="slider-container">
                    <input
                        v-model.number="selectedAmount"
                        type="range"
                        :min="minUserBalance"
                        :max="userBalanceNum"
                        step="1"
                        class="fancy-slider"
                    >
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
                <button
                    :disabled="actionDisabled"
                    class="main-button"
                    @click="doChange"
                >
                    Exchange Now
                </button>
            </div>

            <div
                v-if="txResult"
                class="tx-result"
            >
                {{ txResult }}
            </div>
            <div
                v-if="error"
                class="error"
            >
                {{ error }}
            </div>
        </div>
    </div>
</template>

<style scoped>
.trade-page {
  padding: 12px;
  width: 100%;
  max-width: 500px;
  margin: 0 auto;
}

.card {
  position: relative;
  background: rgba(0, 0, 40, 0.7);
  border-radius: 12px;
  padding: 14px;
  backdrop-filter: blur(4px);
  border: 1px solid rgba(255, 255, 255, 0.06);
}

/* OVERLAY */

.overlay {
  position: absolute;
  inset: 0;
  z-index: 10;
  background: rgba(10, 20, 60, 0.55);
  backdrop-filter: blur(6px);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.overlay-content {
  text-align: center;
  color: #fff;
}

.spinner {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: 3px solid rgba(255,255,255,0.3);
  border-top-color: #4e8cff;
  animation: spin 1s linear infinite;
  margin: 0 auto 14px;
}

.overlay-title {
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 6px;
}

.overlay-sub {
  font-size: 13px;
  opacity: 0.75;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* REST */

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

.fancy-slider {
  width: 100%;
  height: 6px;
  border-radius: 10px;
  background: linear-gradient(90deg, rgba(78, 140, 255, 0.2), rgba(78, 140, 255, 0.4));
  outline: none;
  appearance: none;
}

.fancy-slider::-webkit-slider-thumb {
  appearance: none;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: #4e8cff;
  box-shadow: 0 2px 8px rgba(78, 140, 255, 0.4);
}

.stat {
  display: flex;
  justify-content: space-between;
  padding: 12px 0;
}

.amount-value {
  color: #4e8cff;
  font-weight: 600;
}

.main-button {
  width: 100%;
  padding: 14px;
  border-radius: 12px;
  border: none;
  background: linear-gradient(90deg, #4e8cff, #7aa2ff);
  color: #fff;
  font-weight: 600;
  cursor: pointer;
}

.tx-result,
.error {
  margin-top: 10px;
  padding: 10px;
  border-radius: 10px;
  text-align: center;
  font-size: 13px;
}

.tx-result {
  background: rgba(100, 200, 100, 0.08);
  color: #b3ffb3;
}

.error {
  background: rgba(255, 100, 100, 0.08);
  color: #ffb3b3;
}
</style>
