<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { commaSeparatedNumber } from '#root/common/helpers/numbers'
import { useUserStore } from '../stores/userStore'

interface QuoteResponse {
  floorVotes: string
  yourVotes: string
  mintedCount: number
  eligible: boolean
  queuePosition?: number
  error?: string
}

interface StatusResponse {
  state: string
  minted: boolean
  nftUrl?: string
  canGenerate: boolean
  floorVotes: string
  yourVotes: string
  eligible: boolean
  image?: string
  description?: string
  error?: string
}

const userStore = useUserStore()
const router = useRouter()

const quote = ref<QuoteResponse | null>(null)
const status = ref<StatusResponse | null>(null)
const isGenerating = ref(false)
const justGenerated = ref(false)
const error = ref('')
let pollTimer: ReturnType<typeof setInterval> | undefined

// Wallet binding is the delivery address AND the donation identity — required
// before generating or donating.
const walletBound = computed(() => userStore.wallet !== null)

async function mintApi<T>(path: string): Promise<T | null> {
  if (!userStore.initData) return null
  try {
    const response = await fetch(`/api/mint/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData: userStore.initData }),
    })
    return (await response.json()) as T
  } catch {
    return null
  }
}

async function refresh() {
  const [q, s] = await Promise.all([
    mintApi<QuoteResponse>('quote'),
    mintApi<StatusResponse>('status'),
  ])
  if (q && !q.error) quote.value = q
  if (s && !s.error) {
    status.value = s
    // Flip the gate open as soon as the mint lands so the menu/guard unlock.
    if (s.minted) userStore.setMinted(true)
  }
}

async function generate() {
  if (!walletBound.value || isGenerating.value) return
  isGenerating.value = true
  error.value = ''
  try {
    const result = await mintApi<{ image?: string, description?: string, error?: string }>(
      'generate',
    )
    if (!result || result.error) {
      error.value = result?.error ?? 'Generation failed. Please try again.'
      return
    }
    justGenerated.value = true
    await refresh()
  } finally {
    isGenerating.value = false
  }
}

function enterGame() {
  router.push('/')
}

// Mint lifecycle phase — drives the template. Order matters (first match wins).
const phase = computed(() => {
  if (status.value?.minted) return 'minted'
  if (!walletBound.value) return 'not-connected'
  if (isGenerating.value) return 'generating'
  const s = status.value
  if (!s) return 'ready'
  if (s.state === 'Rework') return 'rework'
  if (justGenerated.value && s.state === 'Submited') return 'preview'
  if (s.state === 'Submited') {
    if (!s.eligible) return 'below-floor'
    return quote.value?.queuePosition != null ? 'in-queue' : 'pending-review'
  }
  return 'ready'
})

const floorVotes = computed(() =>
  commaSeparatedNumber(BigInt(quote.value?.floorVotes ?? status.value?.floorVotes ?? '0')),
)
const yourVotes = computed(() =>
  commaSeparatedNumber(BigInt(quote.value?.yourVotes ?? status.value?.yourVotes ?? '0')),
)
const votesNeeded = computed(() => {
  const floor = BigInt(quote.value?.floorVotes ?? '0')
  const yours = BigInt(quote.value?.yourVotes ?? '0')
  return floor > yours ? commaSeparatedNumber(floor - yours) : '0'
})

onMounted(() => {
  refresh()
  // Poll so admin approval / rising floor / new donations reflect live.
  pollTimer = setInterval(refresh, 15_000)
})

onUnmounted(() => {
  if (pollTimer) clearInterval(pollTimer)
})
</script>

<template>
  <div class="mint-container">
    <h2 class="mint-title">🎟️ Mint your Cube Worlds NFT</h2>

    <!-- not-connected: wallet binding required -->
    <div v-if="phase === 'not-connected'" class="mint-card">
      <p class="mint-lead">Connect your TON wallet to begin.</p>
      <p class="mint-note">
        Your wallet is both the NFT delivery address and your donation identity —
        use the Connect button at the top.
      </p>
    </div>

    <!-- ready: show floor + your votes + Generate -->
    <div v-else-if="phase === 'ready'" class="mint-card">
      <div class="stat-row">
        <span>Mint floor</span><span>{{ floorVotes }} votes</span>
      </div>
      <div class="stat-row">
        <span>Your votes</span><span>{{ yourVotes }}</span>
      </div>
      <button class="main-button" :disabled="!walletBound" @click="generate">
        ✨ Generate my NFT
      </button>
      <p v-if="!walletBound" class="mint-note">Bind a wallet first.</p>
    </div>

    <!-- generating -->
    <div v-else-if="phase === 'generating'" class="mint-card">
      <p class="mint-lead">✨ Generating your pixel-art NFT…</p>
    </div>

    <!-- preview: image + description + eligibility + donate CTA -->
    <div v-else-if="phase === 'preview'" class="mint-card">
      <img v-if="status?.image" :src="status.image" class="preview-image" alt="NFT preview">
      <p class="mint-description">{{ status?.description }}</p>
      <div class="stat-row"><span>Mint floor</span><span>{{ floorVotes }} votes</span></div>
      <div class="stat-row"><span>Your votes</span><span>{{ yourVotes }}</span></div>
      <p v-if="status?.eligible" class="mint-ok">
        ✅ You're eligible — awaiting admin review.
      </p>
      <p v-else class="mint-warn">
        💎 Donate TON to earn {{ votesNeeded }} more votes and qualify to mint.
      </p>
      <button class="main-button secondary" @click="generate">🔄 Regenerate</button>
    </div>

    <!-- below-floor: queued but needs more votes -->
    <div v-else-if="phase === 'below-floor'" class="mint-card">
      <div class="stat-row"><span>Mint floor</span><span>{{ floorVotes }} votes</span></div>
      <div class="stat-row"><span>Your votes</span><span>{{ yourVotes }}</span></div>
      <p class="mint-warn">
        💎 You need {{ votesNeeded }} more votes. Donate TON from your bound wallet
        to rank up — donate more, minted sooner.
      </p>
      <button class="main-button secondary" @click="generate">🔄 Regenerate</button>
    </div>

    <!-- in-queue: eligible, ranked -->
    <div v-else-if="phase === 'in-queue'" class="mint-card">
      <p class="mint-ok">✅ You're in the mint queue.</p>
      <div class="stat-row">
        <span>Your position</span><span>#{{ quote?.queuePosition }}</span>
      </div>
      <p class="mint-note">Donate more TON to climb the queue and mint sooner.</p>
    </div>

    <!-- pending-review: eligible, awaiting admin -->
    <div v-else-if="phase === 'pending-review'" class="mint-card">
      <p class="mint-ok">⏳ Eligible — your NFT is awaiting admin review.</p>
      <img v-if="status?.image" :src="status.image" class="preview-image" alt="NFT preview">
    </div>

    <!-- rework: admin returned it; regenerate -->
    <div v-else-if="phase === 'rework'" class="mint-card">
      <p class="mint-warn">↩️ Your draft was returned. Please regenerate it.</p>
      <button class="main-button" :disabled="!walletBound" @click="generate">
        🔄 Regenerate
      </button>
    </div>

    <!-- minted: enter the game -->
    <div v-else-if="phase === 'minted'" class="mint-card">
      <p class="mint-ok">🎉 Your NFT is minted!</p>
      <a v-if="status?.nftUrl" :href="status.nftUrl" target="_blank" class="nft-link">
        View on-chain
      </a>
      <button class="main-button" @click="enterGame">🚀 Enter the game</button>
    </div>

    <p v-if="error" class="error-text">{{ error }}</p>
  </div>
</template>

<style scoped>
.mint-container {
  max-width: 480px;
  margin: 0 auto;
  color: #fff;
}

.mint-title {
  text-align: center;
  margin-bottom: 1rem;
}

.mint-card {
  background: rgba(0, 0, 51, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 12px;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.mint-lead {
  font-size: 1.1rem;
  text-align: center;
}

.mint-note {
  font-size: 0.85rem;
  opacity: 0.7;
}

.mint-description {
  font-style: italic;
  opacity: 0.9;
}

.mint-ok {
  color: #66ff99;
}

.mint-warn {
  color: #ffcc66;
}

.stat-row {
  display: flex;
  justify-content: space-between;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  padding: 0.25rem 0;
}

.preview-image {
  width: 100%;
  border-radius: 8px;
  image-rendering: pixelated;
}

.main-button {
  background: #ff9933;
  color: #000;
  border: none;
  border-radius: 8px;
  padding: 0.6rem 1rem;
  font-weight: bold;
  cursor: pointer;
}

.main-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.main-button.secondary {
  background: rgba(255, 255, 255, 0.15);
  color: #fff;
}

.nft-link {
  color: #66ccff;
  text-align: center;
}

.error-text {
  color: #ff6666;
  margin-top: 0.5rem;
}
</style>
