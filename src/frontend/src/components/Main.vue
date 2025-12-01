<template>
  <div class="claim-container">
    <h2 class="claim-title">Daily Claim</h2>

    <div class="progress-container">
      <div class="progress-bar">
        <div class="progress-fill" :style="{ width: `${claimProgress}%` }"></div>
        <div class="progress-stars">
          <div v-for="i in 5" :key="i" class="progress-star" :class="{ active: claimProgress >= i * 20 }"></div>
        </div>
      </div>
      <div class="progress-text">{{ Math.floor(claimProgress) }}/100</div>
    </div>

    <div class="next-claim">
      <div class="claim-time">Next full claim: {{ formattedNextClaimDate }}</div>
    </div>

    <button
      class="claim-button"
      :disabled="isButtonDisabled"
      @click="claimCubes"
      :class="{ 'claiming': isClaiming, 'claimed': justClaimed }"
    >
      <span v-if="justClaimed">Claimed!</span>
      <span v-else-if="isClaiming">
        <div class="spinner"></div>
      </span>
      <span v-else>Claim $CUBE</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useUserStore } from "#web/stores/userStore";

const userStore = useUserStore()

// interface ClaimResponse {
//   claim_progress: number;
//   claim_date: string;
// }

const claimProgress = ref(0)
const nextClaimDate = ref('')
const isClaiming = ref(false)
const justClaimed = ref(false)
const lastClaimTime = ref(0)
const nextClaimAmount = ref(0)
const totalClaimed = ref(0)

const isButtonDisabled = computed(() => {
  return isClaiming.value ||
         justClaimed.value ||
         (Date.now() - lastClaimTime.value < 10000)
})

const formattedNextClaimDate = computed(() => {
  if (!nextClaimDate.value) return 'Loading...'

  try {
    const date = new Date(nextClaimDate.value)
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  } catch (e) {
    return 'Unknown'
  }
})

const fetchClaimStatus = async () => {
  try {
    const walletAddress = userStore.wallet?.account.address
    if (!walletAddress) return

    const response = await fetch(`/api/claim?walletAddress=${walletAddress}`)
    const data = await response.json()

    if (data.error) {
      console.error('Error fetching claim status:', data.error)
      return
    }

    claimProgress.value = Math.min((data.nextClaimAmount / 80) * 100, 100) // 80 is max claim amount (8 hours * 10 CUBE)
    nextClaimDate.value = data.nextClaimDate
    nextClaimAmount.value = data.nextClaimAmount
    totalClaimed.value = data.totalClaimed
  } catch (error) {
    console.error('Error fetching claim status:', error)
  }
}

const claimCubes = async () => {
  if (isButtonDisabled.value) return

  const walletAddress = userStore.wallet?.account.address
  if (!walletAddress) {
    console.error('No wallet connected')
    return
  }

  isClaiming.value = true

  try {
    // Sign message for claim
    const message = `Claim ${nextClaimAmount.value} CUBE at ${new Date().toISOString()}`
    // const signature = await userStore.wallet?.connectItems?.tonProof?.signMessage({
    //   message
    // })

    // if (!signature) {
    //   throw new Error('Failed to sign message')
    // }

    const response = await fetch('/api/claim', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        walletAddress,
        // signature,
        message
      })
    })

    const data = await response.json()

    if (data.error) {
      throw new Error(data.error)
    }

    claimProgress.value = 0
    nextClaimDate.value = data.nextClaimDate
    nextClaimAmount.value = 0
    totalClaimed.value = data.totalClaimed

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

onMounted(() => {
  fetchClaimStatus()

  // Update the progress every minute
  setInterval(() => {
    fetchClaimStatus()
  }, 60000)
})
</script>

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

.claim-button {
  width: 100%;
  background: linear-gradient(45deg, #3366ff, #6633ff);
  color: white;
  border: none;
  border-radius: 0.75rem;
  padding: 0.8rem;
  font-size: 1.1rem;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  justify-content: center;
  align-items: center;
  box-shadow: 0 0 15px rgba(102, 51, 255, 0.5);
  text-shadow: 0 0 5px rgba(255, 255, 255, 0.5);
}

.claim-button:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 0 20px rgba(102, 51, 255, 0.7);
}

.claim-button:disabled {
  background: linear-gradient(45deg, #666699, #9999cc);
  cursor: not-allowed;
  opacity: 0.7;
}

.claim-button.claiming {
  background: linear-gradient(45deg, #666699, #9999cc);
}

.claim-button.claimed {
  background: linear-gradient(45deg, #33cc66, #33ccaa);
  animation: pulse 2s;
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
  0%, 100% {
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
