<script setup lang="ts">
import type { TonConnectUI } from '@tonconnect/ui'
import { useUserStore } from '#web/stores/userStore'
import { computed, inject, onMounted, onUnmounted, ref, watch } from 'vue'

interface ClaimStatusResponse {
  hasNeverClaimed: boolean
  canClaim: boolean
  streakDays: number
  claimMultiplier: number
  nextClaimAmount: number
  rewardPerMinute: number
  rewardPerSecond: number
  fractionalCarry: number
  secondsUntilClaim: number
  nextClaimDate: string
  lastClaimDate: string
  lastClaimAmount: number
  progressPercent: number
  totalClaimed: number
  balance?: string
  error?: string
}

const CLAIM_COOLDOWN_MS = 60 * 1000

const tonConnectUI = inject('tonConnectUI') as
  | { value: TonConnectUI | null }
  | undefined
const userStore = useUserStore()
const isAuthorized = computed(() => Boolean(userStore.initData && userStore.user))
const isWalletConnected = computed(() =>
  Boolean(userStore.wallet?.account?.address),
)
const canLoadClaimData = computed(
  () => isAuthorized.value && isWalletConnected.value,
)

const claimProgress = ref(0)
const nextClaimDate = ref('')
const isClaiming = ref(false)
const justClaimed = ref(false)
const lastClaimTime = ref(0)
const nextClaimAmount = ref(0)
const totalClaimed = ref(0)
const streakDays = ref(0)
const claimMultiplier = ref(1)
const canClaim = ref(false)
const rewardPerMinute = ref(0)
const rewardPerSecond = ref(0)
const fractionalCarry = ref(0)
const secondsUntilClaim = ref(0)
const hasNeverClaimed = ref(true)
const lastClaimDateMs = ref(0)
const statusSyncedAtMs = ref(0)
let statusInterval: ReturnType<typeof setInterval> | null = null
let liveTickInterval: ReturnType<typeof setInterval> | null = null
let stopInitDataWatch: (() => void) | null = null

const isButtonDisabled = computed(() => {
  return (
    !canLoadClaimData.value ||
    !canClaim.value ||
    isClaiming.value ||
    justClaimed.value ||
    Date.now() - lastClaimTime.value < 10000
  )
})

const formattedNextClaimDate = computed(() => {
  if (!nextClaimDate.value) return 'Loading...'

  try {
    const date = new Date(nextClaimDate.value)
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return 'Unknown'
  }
})

const formattedClaimAmount = computed(() =>
  nextClaimAmount.value.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 6,
  }),
)

const formattedRewardPerMinute = computed(() =>
  rewardPerMinute.value.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 6,
  }),
)

async function fetchClaimStatus() {
  try {
    if (!canLoadClaimData.value) return

    const response = await fetch('/api/users/claim/status', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        initData: userStore.initData,
      }),
    })
    const data = await response.json()

    if (data.error) {
      console.error('Error fetching claim status:', data.error)
      return
    }
    applyClaimStatus(data)
  } catch (error) {
    console.error('Error fetching claim status:', error)
  }
}

function resetClaimState() {
  claimProgress.value = 0
  nextClaimDate.value = ''
  nextClaimAmount.value = 0
  totalClaimed.value = 0
  streakDays.value = 0
  claimMultiplier.value = 1
  canClaim.value = false
  rewardPerMinute.value = 0
  rewardPerSecond.value = 0
  fractionalCarry.value = 0
  secondsUntilClaim.value = 0
  hasNeverClaimed.value = true
  lastClaimDateMs.value = 0
  statusSyncedAtMs.value = 0
}

function applyClaimStatus(data: ClaimStatusResponse) {
  statusSyncedAtMs.value = Date.now()
  claimProgress.value = data.progressPercent
  nextClaimDate.value = data.nextClaimDate
  nextClaimAmount.value = data.nextClaimAmount
  totalClaimed.value = data.totalClaimed
  streakDays.value = data.streakDays
  claimMultiplier.value = data.claimMultiplier
  canClaim.value = data.canClaim
  rewardPerMinute.value = data.rewardPerMinute
  rewardPerSecond.value = data.rewardPerSecond
  fractionalCarry.value = data.fractionalCarry
  secondsUntilClaim.value = data.secondsUntilClaim
  hasNeverClaimed.value = data.hasNeverClaimed
  lastClaimDateMs.value = Number.isNaN(Date.parse(data.lastClaimDate))
    ? 0
    : Date.parse(data.lastClaimDate)
}

function recalculateLiveClaimAmount() {
  if (!canLoadClaimData.value) return

  if (hasNeverClaimed.value) {
    canClaim.value = true
    claimProgress.value = 100
    secondsUntilClaim.value = 0
    nextClaimAmount.value = Number(
      (
        fractionalCarry.value +
        ((CLAIM_COOLDOWN_MS / 1000) * rewardPerSecond.value)
      ).toFixed(6),
    )
    return
  }

  if (lastClaimDateMs.value <= 0) return
  const elapsedMs = Math.max(0, Date.now() - lastClaimDateMs.value)
  canClaim.value = elapsedMs >= CLAIM_COOLDOWN_MS
  claimProgress.value = Math.min(
    100,
    Math.floor((elapsedMs / CLAIM_COOLDOWN_MS) * 100),
  )
  secondsUntilClaim.value = canClaim.value
    ? 0
    : Math.max(0, Math.ceil((CLAIM_COOLDOWN_MS - elapsedMs) / 1000))
  nextClaimDate.value = canClaim.value
    ? new Date().toISOString()
    : new Date(lastClaimDateMs.value + CLAIM_COOLDOWN_MS).toISOString()

  const dynamicAmount = fractionalCarry.value + ((elapsedMs / 1000) * rewardPerSecond.value)
  nextClaimAmount.value = Number(dynamicAmount.toFixed(6))
}

async function claimCubes() {
  if (isButtonDisabled.value) return

  if (!canLoadClaimData.value) {
    openWalletModal()
    return
  }

  isClaiming.value = true

  try {
    const response = await fetch('/api/users/claim', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        initData: userStore.initData,
      }),
    })

    const data: ClaimStatusResponse = await response.json()

    if (data.error) {
      throw new Error(data.error)
    }

    applyClaimStatus(data)
    if (data.balance) {
      userStore.setBalance(data.balance)
    }

    justClaimed.value = true
    lastClaimTime.value = Date.now()

    setTimeout(() => {
      justClaimed.value = false
    }, 3000)
  } catch (error) {
    console.error('Error claiming cubes:', error)
  } finally {
    isClaiming.value = false
  }
}

function openWalletModal() {
  tonConnectUI?.value?.openModal()
}

onMounted(() => {
  stopInitDataWatch = watch(
    () => [userStore.initData, isWalletConnected.value],
    ([initData, walletConnected]) => {
      if (!initData || !walletConnected) {
        resetClaimState()
        return
      }
      fetchClaimStatus()
    },
    { immediate: true },
  )

  statusInterval = setInterval(() => {
    fetchClaimStatus()
  }, 15000)

  liveTickInterval = setInterval(() => {
    if (!canLoadClaimData.value) return
    recalculateLiveClaimAmount()
    if (Date.now() - statusSyncedAtMs.value > 15000) {
      fetchClaimStatus()
    }
  }, 1000)
})

onUnmounted(() => {
  if (stopInitDataWatch) stopInitDataWatch()
  if (statusInterval) clearInterval(statusInterval)
  if (liveTickInterval) clearInterval(liveTickInterval)
})
</script>

<template>
  <div class="claim-container">
    <h1 class="claim-title">Daily Streak Claim</h1>

    <div v-if="!isAuthorized" class="gate-card">
      <p class="gate-title">Authorizing profile...</p>
      <p class="gate-subtitle">Please wait before opening claim data.</p>
    </div>

    <div v-else-if="!isWalletConnected" class="gate-card">
      <p class="gate-title">Connect wallet to unlock claim</p>
      <p class="gate-subtitle">
        Limited mode: streak, claimable amount, and totals are hidden until
        wallet connection.
      </p>
      <button class="connect-button" @click="openWalletModal">
        Connect wallet
      </button>
    </div>

    <template v-else>
      <div class="progress-container">
        <div class="progress-bar">
          <div class="progress-fill" :style="{ width: `${claimProgress}%` }" />
          <div class="progress-stars">
            <div
              v-for="i in 5"
              :key="i"
              class="progress-star"
              :class="{ active: claimProgress >= i * 20 }"
            />
          </div>
        </div>
        <div class="progress-text">{{ Math.floor(claimProgress) }}%</div>
        <div class="progress-text">Streak: {{ streakDays }} day(s)</div>
      </div>

      <div class="next-claim">
        <div class="claim-time">
          Claim multiplier: x{{ claimMultiplier }} (max x10)
        </div>
        <div class="claim-time">
          Claimable now: {{ formattedClaimAmount }} $CUBE
        </div>
        <div class="claim-time">
          Rate: {{ formattedRewardPerMinute }} $CUBE / minute
        </div>
        <div class="claim-time">
          {{ canClaim ? 'Ready to claim now' : `Next claim in ${secondsUntilClaim}s (${formattedNextClaimDate})` }}
        </div>
        <div class="claim-time">
          Total claimed (credited): {{ totalClaimed }} $CUBE
        </div>
      </div>

      <button
        class="main-button"
        :disabled="isButtonDisabled"
        :class="{ claiming: isClaiming, claimed: justClaimed }"
        @click="claimCubes"
      >
        <span v-if="justClaimed">Claimed!</span>
        <span v-else-if="isClaiming">
          <div class="spinner" />
        </span>
        <span v-else>Claim {{ formattedClaimAmount }} $CUBE</span>
      </button>
    </template>
  </div>
</template>

<style scoped>
.claim-container {
  background-color: rgba(0, 0, 51, 0.7);
  border-radius: 1rem;
  padding: 1.5rem;
  margin: 1rem 0;
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 0 20px rgba(51, 102, 255, 0.2);
  animation: fadeIn 1s;
  backdrop-filter: blur(5px);
}

.claim-title {
  color: #fff;
  font-size: 1.8rem;
  margin-bottom: 1.5rem;
  text-align: center;
  text-shadow: 0 0 8px rgba(255, 255, 255, 0.5);
}

.progress-container {
  margin-bottom: 1.5rem;
}

.progress-bar {
  height: 1.5rem;
  background-color: rgba(255, 255, 255, 0.1);
  border-radius: 0.75rem;
  position: relative;
  overflow: hidden;
  margin-bottom: 0.5rem;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #3366ff, #6633ff);
  border-radius: 0.75rem;
  transition: width 0.5s ease;
  box-shadow: 0 0 10px rgba(102, 51, 255, 0.5);
}

.progress-stars {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 0.5rem;
}

.progress-star {
  width: 0.8rem;
  height: 0.8rem;
  background-color: rgba(255, 255, 255, 0.2);
  border-radius: 50%;
  transition: all 0.3s ease;
}

.progress-star.active {
  background-color: #fff;
  box-shadow: 0 0 8px rgba(255, 255, 255, 0.8);
  transform: scale(1.2);
}

.progress-text {
  color: #fff;
  font-size: 1rem;
  font-weight: bold;
  text-align: center;
  text-shadow: 0 0 5px rgba(255, 255, 255, 0.5);
}

.next-claim {
  margin-bottom: 1.5rem;
  text-align: center;
}

.claim-time {
  color: #ccccff;
  font-size: 0.9rem;
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

.connect-button {
  margin-top: 0.85rem;
  width: 100%;
  border: none;
  border-radius: 0.75rem;
  padding: 0.75rem 1rem;
  color: #fff;
  cursor: pointer;
  font-weight: 700;
  background: linear-gradient(90deg, #4e8cff, #7aa2ff);
}

.spinner {
  width: 1.2rem;
  height: 1.2rem;
  border: 3px solid rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  border-top-color: white;
  animation: spin 1s ease-in-out infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes pulse {
  0%,
  100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.05);
  }
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
