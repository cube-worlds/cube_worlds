<script setup lang="ts">
import { commaSeparatedNumber } from '#root/common/helpers/numbers.ts'
import { computed, onMounted, ref } from 'vue'
import { useRetry } from '../composables/useRetry'

const { retry } = useRetry()

const LIMIT = 100
interface LeaderboardItem {
  wallet: string
  votes: number
}

const leaderboard = ref<LeaderboardItem[]>([])
const skip = ref(0)
const totalWallets = ref<number | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)
const isDev = import.meta.env.VITE_ENV === 'development'

const leaderboardRows = computed(() =>
  leaderboard.value.map((item, index) => ({
    ...item,
    rank: index + 1,
    shortWallet: compactWallet(item.wallet),
  })),
)

const totalDisplayedPoints = computed(() =>
  leaderboard.value.reduce((sum, row) => sum + row.votes, 0),
)

function compactWallet(wallet: string): string {
  if (!wallet) return '-'
  if (wallet.length <= 18) return wallet
  return `${wallet.slice(0, 6)}...${wallet.slice(-6)}`
}

function rankLabel(rank: number): string {
  if (rank === 1) return 'Gold'
  if (rank === 2) return 'Silver'
  if (rank === 3) return 'Bronze'
  return `#${rank}`
}

function rowClass(rank: number): string {
  if (rank <= 3) return `row tier-${rank}`
  return 'row'
}

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
      <div class="header">
        <h1 class="title">$CUBE Leaderboard</h1>
        <div class="summary">
          <div class="metric">
            <span class="metric-label">Wallets</span>
            <span class="metric-value">{{ totalWallets ?? '...' }}</span>
          </div>
          <div class="metric">
            <span class="metric-label">Shown Points</span>
            <span class="metric-value">{{
              commaSeparatedNumber(totalDisplayedPoints)
            }}</span>
          </div>
        </div>
      </div>

      <div class="table-head">
        <span>Rank</span>
        <span>Wallet</span>
        <span class="points-head">Points</span>
      </div>

      <div
        v-for="item in leaderboardRows"
        :key="`${item.wallet}-${item.rank}`"
        :class="rowClass(item.rank)"
      >
        <div class="rank">
          <span class="rank-index">#{{ item.rank }}</span>
          <span class="rank-badge">{{ rankLabel(item.rank) }}</span>
        </div>
        <div class="wallet">
          <a
            :href="`https://${isDev ? 'testnet.' : ''}tonviewer.com/${item.wallet}`"
            target="_blank"
            rel="noopener noreferrer"
            class="wallet-link"
            :title="item.wallet"
          >
            {{ item.shortWallet }}
          </a>
          <div class="wallet-sub">{{ item.wallet }}</div>
        </div>
        <div class="points">
          {{ commaSeparatedNumber(item.votes) }}
        </div>
      </div>

      <div v-if="!leaderboardRows.length && !loading && !error" class="empty">
        No leaderboard data yet.
      </div>

      <div v-if="loading" class="loader">Loading more players...</div>

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
  max-width: 560px;
  margin: 0 auto;
}

.card {
  background:
    radial-gradient(
      circle at 20% -10%,
      rgba(122, 162, 255, 0.18),
      rgba(0, 0, 40, 0.72) 45%
    ),
    rgba(0, 0, 40, 0.8);
  border-radius: 16px;
  padding: 16px;
  backdrop-filter: blur(6px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.35);
}

.header {
  margin-bottom: 14px;
}

.title {
  margin: 0 0 10px;
}

.summary {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.metric {
  padding: 10px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.03);
}

.metric-label {
  display: block;
  font-size: 0.72rem;
  opacity: 0.75;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.metric-value {
  display: block;
  margin-top: 4px;
  font-size: 1rem;
  font-weight: 700;
  color: #a6c1ff;
}

.table-head {
  display: grid;
  grid-template-columns: 80px 1fr 110px;
  gap: 10px;
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  opacity: 0.7;
  padding: 0 10px 8px;
}

.points-head {
  text-align: right;
}

.row {
  display: grid;
  grid-template-columns: 80px 1fr 110px;
  gap: 10px;
  align-items: center;
  padding: 10px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  background: rgba(255, 255, 255, 0.02);
  margin-bottom: 8px;
}

.row.tier-1 {
  border-color: rgba(255, 206, 84, 0.45);
  background: linear-gradient(
    90deg,
    rgba(255, 206, 84, 0.16),
    rgba(255, 255, 255, 0.02)
  );
}

.row.tier-2 {
  border-color: rgba(176, 196, 222, 0.42);
  background: linear-gradient(
    90deg,
    rgba(176, 196, 222, 0.14),
    rgba(255, 255, 255, 0.02)
  );
}

.row.tier-3 {
  border-color: rgba(205, 127, 50, 0.45);
  background: linear-gradient(
    90deg,
    rgba(205, 127, 50, 0.18),
    rgba(255, 255, 255, 0.02)
  );
}

.rank {
  display: flex;
  flex-direction: column;
  line-height: 1.1;
}

.rank-index {
  font-weight: 700;
  color: #9bc4ff;
}

.rank-badge {
  margin-top: 4px;
  font-size: 0.7rem;
  opacity: 0.8;
}

.wallet {
  min-width: 0;
}

.wallet-link {
  display: inline-block;
  max-width: 100%;
  color: #d7e5ff;
  text-decoration: none;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.wallet-link:hover {
  text-decoration: underline;
}

.wallet-sub {
  margin-top: 3px;
  font-size: 0.72rem;
  opacity: 0.6;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.points {
  text-align: right;
  font-weight: 700;
  color: #7fb0ff;
  font-size: 0.92rem;
}

.loader,
.empty {
  text-align: center;
  padding: 14px;
  font-size: 0.86rem;
  opacity: 0.75;
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

@media (max-width: 480px) {
  .table-head,
  .row {
    grid-template-columns: 68px 1fr 92px;
    gap: 8px;
  }

  .points {
    font-size: 0.83rem;
  }
}
</style>
