<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { useUserStore } from '../stores/userStore.js'

interface Bag { gold: number, iron: number, mana: number, food: number }
interface Hero {
  id: string
  heroClass: string
  level: number
  xp: number
  soulbound: boolean
  founderVariant: boolean
  nftMinted: boolean
}
interface CombatRound { attacker: 'hero' | 'enemy', damage: number, heroHp: number, enemyHp: number }
interface DungeonResult { win: boolean, rounds: CombatRound[], loot: Bag, xpGained: number, alreadyRan: boolean }

const HERO_CLASSES = ['knight', 'mage', 'archer', 'rogue'] as const

const userStore = useUserStore()
const heroes = ref<Hero[]>([])
const ranToday = ref(false)
const loadError = ref('')
const actionError = ref('')
const isLoading = ref(false)
const recruiting = ref<string | null>(null)
const running = ref<string | null>(null)
const lastResult = ref<DungeonResult | null>(null)

async function post<T>(url: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ initData: userStore.initData, ...body }),
  })
  return res.json()
}

async function refresh() {
  if (!userStore.initData) return
  isLoading.value = true
  loadError.value = ''
  try {
    const list = await post<{ heroes?: Hero[], error?: string }>('/api/game/heroes', {})
    if (list.error) { loadError.value = list.error; return }
    heroes.value = list.heroes ?? []
    const status = await post<{ ranToday?: boolean, error?: string }>('/api/game/dungeon', {})
    if (!status.error) ranToday.value = status.ranToday ?? false
  } catch (err) {
    loadError.value = 'Failed to load heroes.'
    console.error('Error fetching heroes:', err)
  } finally {
    isLoading.value = false
  }
}

async function recruit(heroClass: string) {
  if (!userStore.initData) return
  recruiting.value = heroClass
  actionError.value = ''
  try {
    const data = await post<{ error?: string }>('/api/game/recruit', { heroClass })
    if (data.error) { actionError.value = data.error; return }
    await refresh()
  } catch (err) {
    actionError.value = 'Failed to recruit.'
    console.error('Error recruiting hero:', err)
  } finally {
    recruiting.value = null
  }
}

async function runDungeon(heroId: string) {
  if (!userStore.initData) return
  running.value = heroId
  actionError.value = ''
  lastResult.value = null
  try {
    const data = await post<DungeonResult & { error?: string }>('/api/game/dungeon/run', { heroId })
    if (data.error) { actionError.value = data.error; return }
    lastResult.value = data
    await refresh()
  } catch (err) {
    actionError.value = 'Failed to run the dungeon.'
    console.error('Error running dungeon:', err)
  } finally {
    running.value = null
  }
}

onMounted(() => { refresh() })
</script>

<template>
  <div class="hero-container">
    <h1 class="hero-title">Heroes</h1>

    <div v-if="!userStore.initData" class="gate-card">
      <p class="gate-title">Authorizing profile...</p>
    </div>

    <template v-else>
      <div v-if="isLoading" class="info-text">Loading heroes...</div>
      <div v-else-if="loadError" class="error-text">{{ loadError }}</div>

      <template v-else>
        <div class="recruit-card">
          <div class="prod-title">Recruit at the Tavern (CUBE + Gold)</div>
          <div class="class-buttons">
            <button
              v-for="c in HERO_CLASSES"
              :key="c"
              class="main-button class-btn"
              :disabled="recruiting === c"
              @click="recruit(c)"
            >
              <span v-if="recruiting === c">...</span><span v-else>{{ c }}</span>
            </button>
          </div>
        </div>

        <div v-if="actionError" class="error-text">{{ actionError }}</div>

        <div v-if="heroes.length === 0" class="info-text">No heroes yet — recruit one above.</div>
        <div v-else class="hero-list">
          <div v-for="h in heroes" :key="h.id" class="hero-card">
            <div class="hero-head">
              <span class="hero-name">
                {{ h.heroClass }} (Lv {{ h.level }})
                <span v-if="h.founderVariant" class="badge">⭐</span>
                <span v-if="h.soulbound" class="badge">🔒</span>
              </span>
              <span class="hero-xp">{{ h.xp }} XP</span>
            </div>
            <button
              class="main-button run-btn"
              :disabled="running === h.id || ranToday"
              @click="runDungeon(h.id)"
            >
              <span v-if="running === h.id">Fighting...</span>
              <span v-else-if="ranToday">Dungeon done today</span>
              <span v-else>Enter daily dungeon</span>
            </button>
          </div>
        </div>

        <div v-if="lastResult" class="result-card">
          <div v-if="lastResult.alreadyRan" class="info-text">Already ran today — replay below.</div>
          <div class="result-head" :class="lastResult.win ? 'win' : 'loss'">
            {{ lastResult.win ? '🏆 Victory!' : '💀 Defeat' }} (+{{ lastResult.xpGained }} XP)
          </div>
          <div v-if="lastResult.win" class="prod-ready">
            Loot: +{{ lastResult.loot.gold }}G {{ lastResult.loot.iron }}I {{ lastResult.loot.mana }}M {{ lastResult.loot.food }}F
          </div>
          <ol class="rounds">
            <li v-for="(r, i) in lastResult.rounds" :key="i" class="round">
              {{ r.attacker === 'hero' ? '🗡️ Hero' : '👹 Enemy' }} hits for {{ r.damage }}
              <span class="hp">(hero {{ r.heroHp }} / enemy {{ r.enemyHp }})</span>
            </li>
          </ol>
        </div>

        <RouterLink class="dispatch-link" to="/">🏰 Back to your castle →</RouterLink>
      </template>
    </template>
  </div>
</template>

<style scoped>
.hero-container {
  background-color: rgba(0, 0, 51, 0.7);
  border-radius: 1rem;
  padding: 1.5rem;
  margin: 1rem 0;
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 0 20px rgba(51, 102, 255, 0.2);
  animation: fadeIn 1s;
  backdrop-filter: blur(5px);
}
.hero-title { color: #fff; font-size: 1.8rem; margin-bottom: 1.25rem; text-align: center; text-shadow: 0 0 8px rgba(255,255,255,0.5); }
.gate-card { padding: 1rem; border-radius: 0.85rem; border: 1px solid rgba(255,255,255,0.12); background: rgba(255,255,255,0.04); text-align: center; }
.gate-title { margin: 0; color: #fff; font-weight: 700; }
.recruit-card { background: rgba(255,255,255,0.04); border-radius: 0.85rem; padding: 0.85rem 1rem; margin-bottom: 1rem; }
.prod-title { color: #ccccff; font-size: 0.9rem; margin-bottom: 0.4rem; }
.class-buttons { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.5rem; }
.class-btn { font-size: 0.85rem; padding: 0.45rem 0.5rem; text-transform: capitalize; }
.hero-list { display: flex; flex-direction: column; gap: 0.6rem; margin-bottom: 1rem; }
.hero-card { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; padding: 0.7rem 1rem; border-radius: 0.85rem; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.04); }
.hero-name { color: #fff; font-weight: 700; font-size: 0.95rem; text-transform: capitalize; }
.hero-xp { color: #aaaacc; font-size: 0.75rem; }
.badge { margin-left: 0.25rem; }
.run-btn { font-size: 0.85rem; padding: 0.45rem 0.9rem; }
.result-card { background: rgba(255,255,255,0.04); border-radius: 0.85rem; padding: 0.85rem 1rem; margin-bottom: 1rem; }
.result-head { font-weight: 700; margin-bottom: 0.5rem; }
.result-head.win { color: #99ffcc; }
.result-head.loss { color: #ff9999; }
.prod-ready { color: #99ffcc; font-size: 0.9rem; margin-bottom: 0.6rem; }
.rounds { margin: 0; padding-left: 1.1rem; color: #ccccff; font-size: 0.78rem; max-height: 9rem; overflow-y: auto; }
.round { margin-bottom: 0.2rem; }
.hp { color: #8888aa; }
.dispatch-link { display: block; text-align: center; color: #aaddff; text-decoration: none; padding: 0.6rem; }
.info-text { color: #ccccff; font-size: 0.9rem; text-align: center; padding: 0.5rem 0; }
.error-text { color: #ff6666; font-size: 0.88rem; text-align: center; padding: 0.5rem 0; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
</style>
