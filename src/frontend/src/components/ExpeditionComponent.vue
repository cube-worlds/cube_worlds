<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useUserStore } from '../stores/userStore.js'

interface World {
  worldId: string
  name: string
  cubePool: number
  explorerCount: number
  totalWeight: number
}

interface MyExpedition {
  worldId: string
  risk: string
  weight: number
}

interface WorldsResponse {
  tickId: string
  energy: { current: number; max: number }
  worlds: World[]
  myExpedition: MyExpedition | null
  error?: string
}

interface ExpeditionResponse {
  worldId: string
  risk: string
  weight: number
  tickId: string
  error?: string
}

interface EnergyRefillResponse {
  energy: { current: number; max: number }
  spent: number
  error?: string
}

const userStore = useUserStore()

const energy = ref<{ current: number; max: number } | null>(null)
const worlds = ref<World[]>([])
const myExpedition = ref<MyExpedition | null>(null)
const risk = ref<'safe' | 'greedy'>('safe')
const boardError = ref('')
const expeditionError = ref('')
const refillError = ref('')
const isLoading = ref(false)
const isSending = ref(false)
const isRefilling = ref(false)

async function fetchBoard() {
  if (!userStore.initData) return
  isLoading.value = true
  boardError.value = ''
  try {
    const response = await fetch('/api/game/worlds', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData: userStore.initData }),
    })
    const data: WorldsResponse = await response.json()
    if (data.error) {
      boardError.value = data.error
      return
    }
    energy.value = data.energy
    worlds.value = data.worlds
    myExpedition.value = data.myExpedition
  } catch (err) {
    boardError.value = 'Failed to load expedition board.'
    console.error('Error fetching worlds:', err)
  } finally {
    isLoading.value = false
  }
}

async function joinExpedition(worldId: string) {
  if (!userStore.initData || myExpedition.value) return
  isSending.value = true
  expeditionError.value = ''
  try {
    const response = await fetch('/api/game/expedition', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData: userStore.initData, worldId, risk: risk.value }),
    })
    const data: ExpeditionResponse = await response.json()
    if (data.error) {
      expeditionError.value = data.error
      return
    }
    await fetchBoard()
  } catch (err) {
    expeditionError.value = 'Failed to join expedition.'
    console.error('Error joining expedition:', err)
  } finally {
    isSending.value = false
  }
}

async function refillEnergy() {
  if (!userStore.initData) return
  isRefilling.value = true
  refillError.value = ''
  try {
    const response = await fetch('/api/game/energy/refill', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData: userStore.initData }),
    })
    const data: EnergyRefillResponse = await response.json()
    if (data.error) {
      refillError.value = data.error
      return
    }
    await fetchBoard()
  } catch (err) {
    refillError.value = 'Failed to refill energy.'
    console.error('Error refilling energy:', err)
  } finally {
    isRefilling.value = false
  }
}

onMounted(() => {
  fetchBoard()
})
</script>

<template>
  <div class="expedition-container">
    <h1 class="expedition-title">Expeditions</h1>

    <div v-if="!userStore.initData" class="gate-card">
      <p class="gate-title">Authorizing profile...</p>
      <p class="gate-subtitle">Please wait before opening expedition data.</p>
    </div>

    <template v-else>
      <div v-if="isLoading" class="info-text">Loading board...</div>
      <div v-else-if="boardError" class="error-text">{{ boardError }}</div>

      <template v-else>
        <!-- Energy bar -->
        <div v-if="energy" class="energy-card">
          <div class="energy-label">Energy: {{ energy.current }} / {{ energy.max }}</div>
          <div class="energy-bar">
            <div
              class="energy-fill"
              :style="{ width: `${energy.max > 0 ? (energy.current / energy.max) * 100 : 0}%` }"
            />
          </div>
        </div>

        <!-- Active expedition notice -->
        <div v-if="myExpedition" class="active-expedition">
          <span class="active-label">Committed to world:</span>
          <span class="active-value">{{ myExpedition.worldId }}</span>
          <span class="active-risk">({{ myExpedition.risk }}, weight {{ myExpedition.weight }})</span>
        </div>

        <!-- Risk toggle -->
        <div class="risk-toggle">
          <span class="toggle-label">Risk:</span>
          <button
            class="toggle-btn"
            :class="{ active: risk === 'safe' }"
            @click="risk = 'safe'"
          >
            Safe
          </button>
          <button
            class="toggle-btn"
            :class="{ active: risk === 'greedy' }"
            @click="risk = 'greedy'"
          >
            Greedy
          </button>
        </div>

        <!-- Expedition error -->
        <div v-if="expeditionError" class="error-text">{{ expeditionError }}</div>

        <!-- World list -->
        <div class="worlds-list">
          <div v-for="world in worlds" :key="world.worldId" class="world-card">
            <div class="world-name">{{ world.name }}</div>
            <div class="world-stats">
              <span class="stat">Pool: {{ world.cubePool.toLocaleString('en-US') }} ◆</span>
              <span class="stat">Explorers: {{ world.explorerCount }}</span>
            </div>
            <button
              class="main-button world-btn"
              :disabled="!!myExpedition || isSending"
              @click="joinExpedition(world.worldId)"
            >
              <span v-if="myExpedition?.worldId === world.worldId">Committed</span>
              <span v-else>Join ({{ risk }})</span>
            </button>
          </div>
        </div>

        <div v-if="worlds.length === 0 && !isLoading" class="info-text">
          No worlds available this tick.
        </div>

        <!-- Refill energy -->
        <div class="refill-section">
          <div v-if="refillError" class="error-text">{{ refillError }}</div>
          <button
            class="main-button refill-btn"
            :disabled="isRefilling"
            @click="refillEnergy"
          >
            <span v-if="isRefilling">Refilling...</span>
            <span v-else>Refill energy (500 ◆)</span>
          </button>
        </div>
      </template>
    </template>
  </div>
</template>

<style scoped>
.expedition-container {
  background-color: rgba(0, 0, 51, 0.7);
  border-radius: 1rem;
  padding: 1.5rem;
  margin: 1rem 0;
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 0 20px rgba(51, 102, 255, 0.2);
  animation: fadeIn 1s;
  backdrop-filter: blur(5px);
}

.expedition-title {
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

.energy-card {
  margin-bottom: 1.2rem;
}

.energy-label {
  color: #ccccff;
  font-size: 0.9rem;
  margin-bottom: 0.4rem;
  text-align: center;
}

.energy-bar {
  height: 0.75rem;
  background-color: rgba(255, 255, 255, 0.1);
  border-radius: 0.375rem;
  overflow: hidden;
}

.energy-fill {
  height: 100%;
  background: linear-gradient(90deg, #3366ff, #6633ff);
  border-radius: 0.375rem;
  transition: width 0.4s ease;
}

.active-expedition {
  background: rgba(51, 204, 102, 0.12);
  border: 1px solid rgba(51, 204, 102, 0.3);
  border-radius: 0.75rem;
  padding: 0.6rem 1rem;
  margin-bottom: 1rem;
  text-align: center;
}

.active-label {
  color: #99ffcc;
  font-size: 0.88rem;
  margin-right: 0.4rem;
}

.active-value {
  color: #fff;
  font-weight: 700;
  font-size: 0.9rem;
  margin-right: 0.4rem;
}

.active-risk {
  color: #aaddff;
  font-size: 0.82rem;
}

.risk-toggle {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.toggle-label {
  color: #ccccff;
  font-size: 0.9rem;
}

.toggle-btn {
  flex: 1;
  padding: 0.45rem 0.75rem;
  border-radius: 0.6rem;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(255, 255, 255, 0.05);
  color: #aaaacc;
  font-size: 0.88rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.toggle-btn.active {
  background: linear-gradient(90deg, #3366ff, #6633ff);
  color: #fff;
  border-color: transparent;
  box-shadow: 0 0 8px rgba(102, 51, 255, 0.4);
}

.worlds-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.world-card {
  padding: 0.85rem 1rem;
  border-radius: 0.85rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.04);
}

.world-name {
  color: #fff;
  font-size: 1rem;
  font-weight: 700;
  margin-bottom: 0.35rem;
}

.world-stats {
  display: flex;
  gap: 1rem;
  margin-bottom: 0.6rem;
}

.stat {
  color: #ccccff;
  font-size: 0.85rem;
}

.world-btn {
  font-size: 0.9rem;
  padding: 0.55rem 0.75rem;
}

.refill-section {
  margin-top: 1.25rem;
}

.refill-btn {
  font-size: 0.95rem;
}

.info-text {
  color: #ccccff;
  font-size: 0.9rem;
  text-align: center;
  padding: 0.75rem 0;
}

.error-text {
  color: #ff6666;
  font-size: 0.88rem;
  text-align: center;
  padding: 0.5rem 0;
  margin-bottom: 0.5rem;
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
