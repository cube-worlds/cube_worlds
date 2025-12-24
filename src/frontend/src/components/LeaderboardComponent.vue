<script setup lang="ts">
import { commaSeparatedNumber } from '#root/common/helpers/numbers.ts'
import { onMounted, ref } from 'vue'
import { useRetry } from '../composables/useRetry'

const { retry } = useRetry()

const LIMIT = 100
const leaderboard = ref<{ wallet: string; votes: number }[]>([])
const skip = ref(0)
const totalWallets = ref<number | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)
const isDev = import.meta.env.VITE_ENV === 'development'

async function fetchTotals() {
  const r = await retry(() => fetch('/api/users/balances'))
  if (!r) {
    error.value = 'Failed to load totals'
    return
  }
  const json = await r.json()
  totalWallets.value = Number(json.wallets ?? 0)
}

async function fetchLeaderboard() {
  if (loading.value) return
  if (
    totalWallets.value !== null &&
    leaderboard.value.length >= totalWallets.value
  )
    return

  loading.value = true
  error.value = null
  try {
    const r = await retry(() =>
      fetch(`/api/users/leaderboard?skip=${skip.value}&limit=${LIMIT}`),
    )
    if (!r) throw new Error('Request failed')

    const json = await r.json()
    const items = (json as any[]).map((i) => ({
      wallet: i.wallet,
      votes: Number(i.votes ?? 0),
    }))
    leaderboard.value.push(...items)
    skip.value += items.length
  } catch (e: any) {
    error.value = e?.message ?? 'Failed to load leaderboard'
  } finally {
    loading.value = false
  }
}

function onScroll(e: Event) {
  const el = e.target as HTMLElement
  if (el.scrollTop + el.clientHeight >= el.scrollHeight - 40) fetchLeaderboard()
}

onMounted(async () => {
  await fetchTotals()
  await fetchLeaderboard()
})
</script>

<template>
  <div class="leaderboard-page" @scroll="onScroll">
    <div class="card">
      <h1>$CUBE Leaderboard</h1>

      <div v-for="(item, i) in leaderboard" :key="item.wallet" class="row">
        <div class="left">
          <div class="index">#{{ i + 1 }}</div>
          <div class="wallet">
            <a
              :href="`https://${isDev ? 'testnet.' : ''}tonviewer.com/${item.wallet}`"
              target="_blank"
              rel="noopener noreferrer"
              class="wallet-link"
              :title="item.wallet"
            >
              {{ item.wallet }}
            </a>
          </div>
        </div>
        <div class="right">
          {{ commaSeparatedNumber(item.votes) }}
        </div>
      </div>

      <div v-if="loading" class="loader">Loading…</div>

      <div v-if="error" class="error">
        {{ error }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.leaderboard-page {
  height: 100vh;
  overflow-y: auto;
  padding: 12px;
  max-width: 500px;
  margin: 0 auto;
}

.card {
  background: rgba(0, 0, 40, 0.7);
  border-radius: 12px;
  padding: 14px;
  backdrop-filter: blur(4px);
  border: 1px solid rgba(255, 255, 255, 0.06);
}

h1 {
  margin-bottom: 12px;
}

.row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.left {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  flex: 1 1 0; /* allow wallet to shrink */
  min-width: 0; /* key for ellipsis inside flex */
}

.index {
  color: #4e8cff;
  font-weight: 600;
  width: 32px;
}

.wallet {
  font-size: 13px;
  opacity: 0.85;
  min-width: 0; /* important for flex shrink */
  overflow: hidden; /* hide overflowing content */
  text-overflow: ellipsis;
  white-space: nowrap; /* prevent line break */
}

.wallet-link {
  display: inline-block;
  max-width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 0.75rem;
  opacity: 0.85;
  vertical-align: middle;
}

.right {
  font-weight: 600;
  color: #4e8cff;
  font-size: 13px;
}

.loader {
  text-align: center;
  padding: 12px;
  font-size: 13px;
  opacity: 0.7;
}

.error {
  margin-top: 10px;
  padding: 10px;
  border-radius: 10px;
  text-align: center;
  font-size: 13px;
  background: rgba(255, 100, 100, 0.08);
  color: #ffb3b3;
}
</style>
