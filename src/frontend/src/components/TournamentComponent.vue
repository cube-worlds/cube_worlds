<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useUserStore } from '../stores/userStore.js'

interface LeaderRow { userId: number, score: number, rank: number }

const userStore = useUserStore()

const weekEnd = ref(0)
const entrantCount = ref(0)
const entryFeeCube = ref(0)
const prizePoolUsdt = ref(0)
const leaderboard = ref<LeaderRow[]>([])
const myEntry = ref<{ entered: boolean, bonus?: boolean, score?: number, rank?: number | null }>({ entered: false })

const error = ref('')
const notice = ref('')
const isLoading = ref(false)
const isBusy = ref(false)

const countdown = computed(() => {
  const ms = weekEnd.value - Date.now()
  if (ms <= 0)
    return 'settling…'
  const h = Math.floor(ms / 3_600_000)
  const d = Math.floor(h / 24)
  return d > 0 ? `${d}d ${h % 24}h` : `${h}h`
})

async function game(path: string, body: Record<string, unknown> = {}) {
  const response = await fetch(`/api/game/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ initData: userStore.initData, ...body }),
  })
  return response.json()
}

async function load() {
  if (!userStore.initData)
    return
  isLoading.value = true
  error.value = ''
  try {
    const data = await game('tournament')
    if (data.error) {
      error.value = data.error
      return
    }
    weekEnd.value = data.weekEnd
    entrantCount.value = data.entrantCount
    entryFeeCube.value = data.entryFeeCube
    prizePoolUsdt.value = data.prizePoolUsdt
    leaderboard.value = data.leaderboard ?? []
    myEntry.value = data.myEntry ?? { entered: false }
  } catch (err) {
    error.value = 'Failed to load tournament.'
    console.error(err)
  } finally {
    isLoading.value = false
  }
}

async function enter() {
  if (!userStore.initData)
    return
  isBusy.value = true
  error.value = ''
  notice.value = ''
  try {
    const data = await game('tournament/enter')
    if (data.error) {
      error.value = data.error
      return
    }
    notice.value = data.bonus ? 'Entered free with your Season Pass!' : `Entered — ${data.entryFeeCube} CUBE spent.`
    await load()
  } catch (err) {
    error.value = 'Failed to enter.'
    console.error(err)
  } finally {
    isBusy.value = false
  }
}

async function watchAd() {
  if (!userStore.initData)
    return
  isBusy.value = true
  error.value = ''
  notice.value = ''
  try {
    const data = await game('ad-nonce')
    if (data.error || !data.blockId) {
      error.value = data.error || 'Ads are not available.'
      return
    }
    // The nonce (data.payload) is verified by the backend when Adsgram fires its
    // server-to-server reward postback. The dashboard reward URL must forward the
    // payload to /api/game/ad-reward. Verify the exact pass-through mechanism
    // against the current Adsgram SDK.
    const adsgram = (window as any).Adsgram
    if (!adsgram) {
      error.value = 'Ad SDK not loaded.'
      return
    }
    const controller = adsgram.init({ blockId: data.blockId })
    await controller.show()
    notice.value = 'Thanks for watching! Energy will be credited shortly.'
  } catch {
    error.value = 'Ad was skipped or failed.'
  } finally {
    isBusy.value = false
  }
}

async function buySeasonPass() {
  if (!userStore.initData)
    return
  isBusy.value = true
  error.value = ''
  notice.value = ''
  try {
    const data = await game('season-pass/invoice')
    if (data.error || !data.link) {
      error.value = data.error || 'Could not start purchase.'
      return
    }
    const tg = (window as any).Telegram?.WebApp
    if (tg?.openInvoice) {
      tg.openInvoice(data.link, (status: string) => {
        if (status === 'paid')
          notice.value = 'Season Pass active!'
      })
    } else {
      window.open(data.link, '_blank')
    }
  } catch {
    error.value = 'Could not start purchase.'
  } finally {
    isBusy.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="t-container">
    <h1 class="t-title">Weekly Tournament</h1>

    <div v-if="!userStore.initData" class="gate-card">
      <p class="gate-title">Authorizing profile…</p>
    </div>

    <template v-else>
      <div class="prize-card">
        <span class="prize-label">Prize pool</span>
        <span class="prize-value">{{ prizePoolUsdt }} USDT</span>
        <span class="prize-sub">{{ entrantCount }} explorers · ends in {{ countdown }}</span>
      </div>

      <div v-if="error" class="error-text">{{ error }}</div>
      <div v-if="notice" class="notice-text">{{ notice }}</div>

      <div class="section">
        <div v-if="myEntry.entered" class="entered-badge">
          Entered{{ myEntry.bonus ? ' (free)' : '' }} · rank {{ myEntry.rank ?? '—' }} · {{ myEntry.score ?? 0 }} CUBE
        </div>
        <button v-else class="main-button" :disabled="isBusy" @click="enter">
          Enter ({{ entryFeeCube }} CUBE)
        </button>
      </div>

      <div class="section">
        <div class="section-title">Leaderboard</div>
        <div v-if="isLoading" class="info-text">Loading…</div>
        <ol v-else class="board">
          <li v-for="row in leaderboard" :key="row.userId" class="board-row">
            <span class="board-rank">#{{ row.rank }}</span>
            <span class="board-user">Explorer {{ row.userId }}</span>
            <span class="board-score">{{ row.score }}</span>
          </li>
          <li v-if="leaderboard.length === 0" class="info-text">No entrants yet — be the first.</li>
        </ol>
      </div>

      <div class="section perks">
        <button class="ghost-button" :disabled="isBusy" @click="watchAd">
          ⚡ Watch ad for energy
        </button>
        <button class="ghost-button" :disabled="isBusy" @click="buySeasonPass">
          ⭐ Get Season Pass
        </button>
      </div>
    </template>
  </div>
</template>

<style scoped>
.t-container {
  background-color: rgba(0, 0, 51, 0.7);
  border-radius: 1rem;
  padding: 1.5rem;
  margin: 1rem 0;
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 0 20px rgba(51, 102, 255, 0.2);
  backdrop-filter: blur(5px);
}

.t-title {
  color: #fff;
  font-size: 1.8rem;
  margin-bottom: 1.2rem;
  text-align: center;
  text-shadow: 0 0 8px rgba(255, 255, 255, 0.5);
}

.gate-card,
.prize-card {
  text-align: center;
}

.prize-card {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  margin-bottom: 1rem;
}

.prize-label {
  color: #ccccff;
  font-size: 0.9rem;
}

.prize-value {
  color: #fff;
  font-size: 1.7rem;
  font-weight: 700;
  text-shadow: 0 0 8px rgba(102, 51, 255, 0.4);
}

.prize-sub {
  color: #b9c6ff;
  font-size: 0.82rem;
}

.section {
  margin-bottom: 1.1rem;
}

.section-title {
  color: #ccccff;
  font-size: 0.9rem;
  margin-bottom: 0.5rem;
}

.entered-badge {
  text-align: center;
  color: #99ffcc;
  font-size: 0.92rem;
  padding: 0.6rem;
  border: 1px solid rgba(153, 255, 204, 0.3);
  border-radius: 0.6rem;
}

.board {
  list-style: none;
  margin: 0;
  padding: 0;
}

.board-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.45rem 0.2rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  color: #e7ecff;
  font-size: 0.9rem;
}

.board-rank {
  width: 2.2rem;
  color: #ffd479;
  font-weight: 700;
}

.board-user {
  flex: 1;
}

.board-score {
  color: #fff;
  font-weight: 600;
}

.perks {
  display: flex;
  gap: 0.5rem;
}

.main-button,
.ghost-button {
  width: 100%;
  padding: 0.7rem;
  border-radius: 0.7rem;
  border: none;
  font-size: 0.95rem;
  font-weight: 700;
  cursor: pointer;
  color: #fff;
}

.main-button {
  background: linear-gradient(135deg, #3366ff, #6633ff);
}

.ghost-button {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.2);
  font-size: 0.85rem;
}

.main-button:disabled,
.ghost-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
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
  padding: 0.4rem 0;
}

.notice-text {
  color: #99ffcc;
  font-size: 0.88rem;
  text-align: center;
  padding: 0.4rem 0;
}
</style>
