<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useUserStore } from '../stores/userStore.js'

const userStore = useUserStore()

const balance = ref(0)
const currency = ref('USDT')
const error = ref('')
const notice = ref('')
const isLoading = ref(false)
const isBusy = ref(false)

const depositAmount = ref(1)
const wd = ref({ network: 'TON', address: '', amount: 1 })
const tr = ref({ tgUserId: 0, amount: 1 })

const networks = ['TON', 'BSC', 'ETH', 'BTC', 'TRX', 'SOL']

// $CUBE on-chain bridge state
const cubeBridgeAvailable = ref(false)
const cubeBalance = ref('')
const cubeDepositAddress = ref('')
const cubeCanWithdraw = ref(false)
const cubeCooldown = ref(0)
const cubeWithdrawAmount = ref('')
const cubeError = ref('')
const cubeBusy = ref(false)

async function api(path: string, body: Record<string, unknown>) {
  const response = await fetch(`/api/wallet/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ initData: userStore.initData, ...body }),
  })
  return response.json()
}

async function cubeApi(path: string, body: Record<string, unknown>) {
  const response = await fetch(`/api/cube/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ initData: userStore.initData, ...body }),
  })
  return response.json()
}

async function loadBalance() {
  if (!userStore.initData)
    return
  isLoading.value = true
  error.value = ''
  try {
    const data = await api('balance', {})
    if (data.error) {
      error.value = data.error
      return
    }
    balance.value = data.balance
    currency.value = data.currency
  } catch (err) {
    error.value = 'Failed to load balance.'
    console.error('Error loading balance:', err)
  } finally {
    isLoading.value = false
  }
}

async function deposit() {
  if (!userStore.initData)
    return
  isBusy.value = true
  error.value = ''
  notice.value = ''
  try {
    const data = await api('invoice', { amount: depositAmount.value })
    if (data.error) {
      error.value = data.error
      return
    }
    window.open(data.link, '_blank')
    notice.value = 'Invoice opened — complete payment in your wallet.'
  } catch (err) {
    error.value = 'Failed to create invoice.'
    console.error('Error creating invoice:', err)
  } finally {
    isBusy.value = false
  }
}

async function buyEnergy() {
  if (!userStore.initData)
    return
  isBusy.value = true
  error.value = ''
  notice.value = ''
  try {
    const data = await api('buy-energy', {})
    if (data.error) {
      error.value = data.error
      return
    }
    notice.value = `Energy pack bought — energy now ${data.energy}.`
    await loadBalance()
  } catch (err) {
    error.value = 'Failed to buy energy.'
    console.error('Error buying energy:', err)
  } finally {
    isBusy.value = false
  }
}

async function withdraw() {
  if (!userStore.initData)
    return
  isBusy.value = true
  error.value = ''
  notice.value = ''
  try {
    const data = await api('withdraw', { ...wd.value })
    if (data.error) {
      error.value = data.error
      return
    }
    notice.value = `Withdrawal ${data.status} (fee ${data.feeUsdt} USDT).`
    await loadBalance()
  } catch (err) {
    error.value = 'Failed to withdraw.'
    console.error('Error withdrawing:', err)
  } finally {
    isBusy.value = false
  }
}

async function transfer() {
  if (!userStore.initData)
    return
  isBusy.value = true
  error.value = ''
  notice.value = ''
  try {
    const data = await api('transfer', { ...tr.value })
    if (data.error) {
      error.value = data.error
      return
    }
    notice.value = 'Transfer sent.'
    await loadBalance()
  } catch (err) {
    error.value = 'Failed to transfer.'
    console.error('Error transferring:', err)
  } finally {
    isBusy.value = false
  }
}

async function loadCubeStatus() {
  if (!userStore.initData)
    return
  try {
    const data = await cubeApi('status', {})
    if (data.error || !data.depositAddress) {
      cubeBridgeAvailable.value = false
      return
    }
    cubeBridgeAvailable.value = true
    cubeBalance.value = data.balance
    cubeDepositAddress.value = data.depositAddress
    cubeCanWithdraw.value = data.canWithdraw
    cubeCooldown.value = data.cooldownSecondsRemaining ?? 0
  } catch {
    cubeBridgeAvailable.value = false
  }
}

async function copyCubeAddress() {
  try {
    await navigator.clipboard.writeText(cubeDepositAddress.value)
  } catch {
    // clipboard unavailable — silently ignore
  }
}

async function cubeWithdraw() {
  if (!userStore.initData)
    return
  cubeBusy.value = true
  cubeError.value = ''
  try {
    const data = await cubeApi('withdraw', { amount: cubeWithdrawAmount.value })
    if (data.error) {
      cubeError.value = data.error
      return
    }
    cubeWithdrawAmount.value = ''
    await loadCubeStatus()
  } catch {
    cubeError.value = 'Failed to withdraw CUBE.'
  } finally {
    cubeBusy.value = false
  }
}

onMounted(() => {
  loadBalance()
  loadCubeStatus()
})
</script>

<template>
  <div class="wallet-container">
    <h1 class="wallet-title">Wallet</h1>

    <div v-if="!userStore.initData" class="gate-card">
      <p class="gate-title">Authorizing profile...</p>
      <p class="gate-subtitle">Please wait before opening your wallet.</p>
    </div>

    <template v-else>
      <div class="balance-card">
        <span class="balance-label">Balance</span>
        <span class="balance-value">{{ balance }} {{ currency }}</span>
      </div>

      <div v-if="isLoading" class="info-text">Loading...</div>
      <div v-if="error" class="error-text">{{ error }}</div>
      <div v-if="notice" class="notice-text">{{ notice }}</div>

      <!-- Deposit -->
      <div class="section">
        <div class="section-title">Deposit</div>
        <div class="row">
          <input v-model.number="depositAmount" type="number" min="0.1" step="0.1" class="field">
          <button class="main-button" :disabled="isBusy" @click="deposit">Deposit</button>
        </div>
      </div>

      <!-- Buy energy -->
      <div class="section">
        <button class="main-button" :disabled="isBusy" @click="buyEnergy">
          Buy Energy pack (0.5 USDT)
        </button>
      </div>

      <!-- Withdraw -->
      <div class="section">
        <div class="section-title">Withdraw</div>
        <div class="row">
          <select v-model="wd.network" class="field">
            <option v-for="n in networks" :key="n" :value="n">{{ n }}</option>
          </select>
          <input v-model.number="wd.amount" type="number" min="0" step="0.1" class="field">
        </div>
        <input v-model="wd.address" placeholder="address" class="field full">
        <button class="main-button" :disabled="isBusy" @click="withdraw">Withdraw</button>
      </div>

      <!-- Transfer -->
      <div class="section">
        <div class="section-title">Send (free)</div>
        <div class="row">
          <input v-model.number="tr.tgUserId" type="number" placeholder="tg user id" class="field">
          <input v-model.number="tr.amount" type="number" min="0" step="0.1" class="field">
        </div>
        <button class="main-button" :disabled="isBusy" @click="transfer">Send</button>
      </div>

      <!-- $CUBE on-chain bridge -->
      <div v-if="cubeBridgeAvailable" class="section">
        <div class="section-title">$CUBE On-Chain</div>
        <div class="balance-card cube-balance-card">
          <span class="balance-label">CUBE Balance</span>
          <span class="balance-value">{{ cubeBalance }} CUBE</span>
        </div>
        <div class="section-title">Deposit address</div>
        <div class="row">
          <input :value="cubeDepositAddress" readonly class="field">
          <button class="main-button" @click="copyCubeAddress">Copy</button>
        </div>
        <div class="section-title">Withdraw</div>
        <div class="row">
          <input v-model="cubeWithdrawAmount" type="number" min="0" placeholder="amount" class="field">
          <button
            class="main-button"
            :disabled="cubeBusy || !cubeCanWithdraw"
            @click="cubeWithdraw"
          >
            Withdraw
          </button>
        </div>
        <div v-if="!cubeCanWithdraw && cubeCooldown > 0" class="info-text">
          Cooldown: {{ cubeCooldown }}s remaining
        </div>
        <div v-if="cubeError" class="error-text">{{ cubeError }}</div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.wallet-container {
  background-color: rgba(0, 0, 51, 0.7);
  border-radius: 1rem;
  padding: 1.5rem;
  margin: 1rem 0;
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 0 20px rgba(51, 102, 255, 0.2);
  animation: fadeIn 1s;
  backdrop-filter: blur(5px);
}

.wallet-title {
  color: #fff;
  font-size: 1.8rem;
  margin-bottom: 1.5rem;
  text-align: center;
  text-shadow: 0 0 8px rgba(255, 255, 255, 0.5);
}

.gate-card {
  padding: 1rem;
  border-radius: 0.85rem;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.04);
  text-align: center;
}

.gate-title {
  margin: 0;
  color: #fff;
  font-size: 1rem;
  font-weight: 700;
}

.gate-subtitle {
  margin: 0.6rem 0 0;
  color: #d2ddff;
  font-size: 0.88rem;
}

.balance-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.3rem;
  margin-bottom: 1.2rem;
}

.balance-label {
  color: #ccccff;
  font-size: 0.9rem;
}

.balance-value {
  color: #fff;
  font-size: 1.6rem;
  font-weight: 700;
  text-shadow: 0 0 8px rgba(102, 51, 255, 0.4);
}

.section {
  margin-bottom: 1.1rem;
}

.section-title {
  color: #ccccff;
  font-size: 0.9rem;
  margin-bottom: 0.5rem;
}

.row {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.field {
  flex: 1;
  padding: 0.5rem 0.7rem;
  border-radius: 0.6rem;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(255, 255, 255, 0.05);
  color: #fff;
  font-size: 0.9rem;
}

.field.full {
  width: 100%;
  margin-bottom: 0.5rem;
}

.info-text {
  color: #ccccff;
  font-size: 0.9rem;
  text-align: center;
  padding: 0.5rem 0;
}

.error-text {
  color: #ff6666;
  font-size: 0.88rem;
  text-align: center;
  padding: 0.5rem 0;
  margin-bottom: 0.5rem;
}

.notice-text {
  color: #99ffcc;
  font-size: 0.88rem;
  text-align: center;
  padding: 0.5rem 0;
  margin-bottom: 0.5rem;
}

.cube-balance-card {
  margin-bottom: 1rem;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
