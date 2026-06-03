<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { useUserStore } from '../stores/userStore.js'

interface Bag { gold: number, iron: number, mana: number, food: number }
interface Tracks { walls: number, forge: number, tavern: number, mine: number }
interface CastleStatus {
  isFounder: boolean
  resources: Bag
  tracks: Tracks
  claimable: Bag
  secondsUntilTick: number
  error?: string
}

const userStore = useUserStore()
const status = ref<CastleStatus | null>(null)
const loadError = ref('')
const actionError = ref('')
const isLoading = ref(false)
const isClaiming = ref(false)
const upgrading = ref<string | null>(null)

const TRACKS: Array<{ key: keyof Tracks, label: string, desc: string }> = [
  { key: 'mine', label: 'Mine', desc: 'Resource production rate' },
  { key: 'walls', label: 'Walls', desc: 'PvP defense' },
  { key: 'forge', label: 'Forge', desc: 'Equipment quality' },
  { key: 'tavern', label: 'Tavern', desc: 'Hero recruitment cap' },
]

async function fetchCastle() {
  if (!userStore.initData) return
  isLoading.value = true
  loadError.value = ''
  try {
    const res = await fetch('/api/game/castle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData: userStore.initData }),
    })
    const data: CastleStatus = await res.json()
    if (data.error) { loadError.value = data.error; return }
    status.value = data
  } catch (err) {
    loadError.value = 'Failed to load castle.'
    console.error('Error fetching castle:', err)
  } finally {
    isLoading.value = false
  }
}

async function claimProduction() {
  if (!userStore.initData) return
  isClaiming.value = true
  actionError.value = ''
  try {
    const res = await fetch('/api/game/castle/claim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData: userStore.initData }),
    })
    const data = await res.json()
    if (data.error) { actionError.value = data.error; return }
    await fetchCastle()
  } catch (err) {
    actionError.value = 'Failed to claim production.'
    console.error('Error claiming production:', err)
  } finally {
    isClaiming.value = false
  }
}

async function upgrade(track: string) {
  if (!userStore.initData) return
  upgrading.value = track
  actionError.value = ''
  try {
    const res = await fetch('/api/game/castle/upgrade', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData: userStore.initData, track }),
    })
    const data = await res.json()
    if (data.error) { actionError.value = data.error; return }
    await fetchCastle()
  } catch (err) {
    actionError.value = 'Failed to upgrade.'
    console.error('Error upgrading castle:', err)
  } finally {
    upgrading.value = null
  }
}

const hasClaimable = (b: Bag) => b.gold + b.iron + b.mana + b.food > 0

onMounted(() => { fetchCastle() })
</script>

<template>
  <div class="castle-container">
    <h1 class="castle-title">Your Castle</h1>

    <div v-if="!userStore.initData" class="gate-card">
      <p class="gate-title">Authorizing profile...</p>
    </div>

    <template v-else>
      <div v-if="isLoading" class="info-text">Loading castle...</div>
      <div v-else-if="loadError" class="error-text">{{ loadError }}</div>

      <template v-else-if="status">
        <div v-if="status.isFounder" class="founder-badge">⭐ Founder — +20% production</div>

        <div class="resource-grid">
          <div class="resource"><span class="r-label">Gold</span><span class="r-val">{{ status.resources.gold }}</span></div>
          <div class="resource"><span class="r-label">Iron</span><span class="r-val">{{ status.resources.iron }}</span></div>
          <div class="resource"><span class="r-label">Mana</span><span class="r-val">{{ status.resources.mana }}</span></div>
          <div class="resource"><span class="r-label">Food</span><span class="r-val">{{ status.resources.food }}</span></div>
        </div>

        <div class="production-card">
          <div class="prod-title">Production</div>
          <div v-if="hasClaimable(status.claimable)" class="prod-ready">
            +{{ status.claimable.gold }}G {{ status.claimable.iron }}I {{ status.claimable.mana }}M {{ status.claimable.food }}F ready
          </div>
          <div v-else class="info-text">Next tick in {{ Math.ceil(status.secondsUntilTick / 60) }} min</div>
          <button class="main-button" :disabled="isClaiming || !hasClaimable(status.claimable)" @click="claimProduction">
            <span v-if="isClaiming">Claiming...</span><span v-else>Claim production</span>
          </button>
        </div>

        <div v-if="actionError" class="error-text">{{ actionError }}</div>

        <div class="tracks-list">
          <div v-for="t in TRACKS" :key="t.key" class="track-card">
            <div class="track-head">
              <span class="track-name">{{ t.label }} (Lv {{ status.tracks[t.key] }})</span>
              <span class="track-desc">{{ t.desc }}</span>
            </div>
            <button class="main-button track-btn" :disabled="upgrading === t.key" @click="upgrade(t.key)">
              <span v-if="upgrading === t.key">Upgrading...</span><span v-else>Upgrade</span>
            </button>
          </div>
        </div>

        <RouterLink class="dispatch-link" to="/expeditions">⚔️ Dispatch a hero on expedition →</RouterLink>
      </template>
    </template>
  </div>
</template>

<style scoped>
.castle-container {
  background-color: rgba(0, 0, 51, 0.7);
  border-radius: 1rem;
  padding: 1.5rem;
  margin: 1rem 0;
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 0 20px rgba(51, 102, 255, 0.2);
  animation: fadeIn 1s;
  backdrop-filter: blur(5px);
}
.castle-title { color: #fff; font-size: 1.8rem; margin-bottom: 1.25rem; text-align: center; text-shadow: 0 0 8px rgba(255,255,255,0.5); }
.gate-card { padding: 1rem; border-radius: 0.85rem; border: 1px solid rgba(255,255,255,0.12); background: rgba(255,255,255,0.04); text-align: center; }
.gate-title { margin: 0; color: #fff; font-weight: 700; }
.founder-badge { text-align: center; color: #ffd966; font-weight: 700; margin-bottom: 1rem; }
.resource-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.5rem; margin-bottom: 1rem; }
.resource { background: rgba(255,255,255,0.05); border-radius: 0.6rem; padding: 0.5rem; text-align: center; }
.r-label { display: block; color: #aaaacc; font-size: 0.72rem; }
.r-val { display: block; color: #fff; font-weight: 700; }
.production-card { background: rgba(255,255,255,0.04); border-radius: 0.85rem; padding: 0.85rem 1rem; margin-bottom: 1rem; }
.prod-title { color: #ccccff; font-size: 0.9rem; margin-bottom: 0.4rem; }
.prod-ready { color: #99ffcc; font-size: 0.9rem; margin-bottom: 0.6rem; }
.tracks-list { display: flex; flex-direction: column; gap: 0.6rem; margin-bottom: 1rem; }
.track-card { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; padding: 0.7rem 1rem; border-radius: 0.85rem; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.04); }
.track-name { color: #fff; font-weight: 700; font-size: 0.95rem; display: block; }
.track-desc { color: #aaaacc; font-size: 0.75rem; }
.track-btn { font-size: 0.85rem; padding: 0.45rem 0.9rem; }
.dispatch-link { display: block; text-align: center; color: #aaddff; text-decoration: none; padding: 0.6rem; }
.info-text { color: #ccccff; font-size: 0.9rem; text-align: center; padding: 0.5rem 0; }
.error-text { color: #ff6666; font-size: 0.88rem; text-align: center; padding: 0.5rem 0; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
</style>
