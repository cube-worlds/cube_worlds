<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { useUserStore } from '../stores/userStore.js'

interface Boss { name: string, hp: number, atk: number, def: number }
interface Hero { id: string, heroClass: string, level: number }
interface CombatRound { attacker: 'hero' | 'enemy', damage: number, heroHp: number, enemyHp: number }
interface BossStatus {
  week: number
  boss: Boss
  yourDamage: number
  yourRank: number | null
  contributors: number
  attackedToday: boolean
}
interface AttackResult { damage: number, rounds: CombatRound[], xpGained: number, leveledUp: boolean }

const userStore = useUserStore()
const status = ref<BossStatus | null>(null)
const heroes = ref<Hero[]>([])
const chosenHero = ref('')
const loadError = ref('')
const actionError = ref('')
const isLoading = ref(false)
const attacking = ref(false)
const lastResult = ref<AttackResult | null>(null)

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
    const s = await post<BossStatus & { error?: string }>('/api/game/boss', {})
    if (s.error) { loadError.value = s.error; return }
    status.value = s
    const list = await post<{ heroes?: Hero[], error?: string }>('/api/game/heroes', {})
    if (!list.error) {
      heroes.value = list.heroes ?? []
      if (!chosenHero.value && heroes.value.length) chosenHero.value = heroes.value[0].id
    }
  } catch (err) {
    loadError.value = 'Failed to load the boss.'
    console.error('Error fetching boss:', err)
  } finally {
    isLoading.value = false
  }
}

async function attack() {
  if (!userStore.initData || !chosenHero.value) return
  attacking.value = true
  actionError.value = ''
  lastResult.value = null
  try {
    const data = await post<AttackResult & { error?: string }>('/api/game/boss/attack', { heroId: chosenHero.value })
    if (data.error) { actionError.value = data.error; return }
    lastResult.value = data
    await refresh()
  } catch (err) {
    actionError.value = 'Failed to attack the boss.'
    console.error('Error attacking boss:', err)
  } finally {
    attacking.value = false
  }
}

onMounted(() => { refresh() })
</script>

<template>
  <div class="boss-container">
    <h1 class="boss-title">Weekly Boss</h1>

    <div v-if="!userStore.initData" class="gate-card">
      <p class="gate-title">Authorizing profile...</p>
    </div>

    <template v-else>
      <div v-if="isLoading" class="info-text">Loading boss...</div>
      <div v-else-if="loadError" class="error-text">{{ loadError }}</div>

      <template v-else-if="status">
        <div class="boss-card">
          <div class="boss-name">🐉 {{ status.boss.name }}</div>
          <div class="boss-stats">{{ status.boss.hp }} ❤ · {{ status.boss.atk }} ⚔ · {{ status.boss.def }} 🛡</div>
          <div class="board">
            Your damage: <strong>{{ status.yourDamage }}</strong>
            <span v-if="status.yourRank"> · rank #{{ status.yourRank }} of {{ status.contributors }}</span>
          </div>
        </div>

        <div class="attack-card">
          <div class="prod-title">Send a hero to deal damage (once per day)</div>
          <div class="attack-row">
            <select v-model="chosenHero" class="hero-select">
              <option v-for="h in heroes" :key="h.id" :value="h.id">{{ h.heroClass }} Lv{{ h.level }}</option>
            </select>
            <button
              class="main-button"
              :disabled="attacking || status.attackedToday || !chosenHero"
              @click="attack"
            >
              <span v-if="attacking">Attacking...</span>
              <span v-else-if="status.attackedToday">Attacked today</span>
              <span v-else>⚔️ Attack</span>
            </button>
          </div>
          <div v-if="heroes.length === 0" class="info-text">Recruit a hero first.</div>
        </div>

        <div v-if="actionError" class="error-text">{{ actionError }}</div>

        <div v-if="lastResult" class="result-card">
          <div class="result-head">💥 Dealt {{ lastResult.damage }} damage (+{{ lastResult.xpGained }} XP{{ lastResult.leveledUp ? ', level up!' : '' }})</div>
          <ol class="rounds">
            <li v-for="(r, i) in lastResult.rounds" :key="i" class="round">
              {{ r.attacker === 'hero' ? '🗡️ Hero' : '🐉 Boss' }} hits for {{ r.damage }}
              <span class="hp">(hero {{ r.heroHp }} / boss {{ r.enemyHp }})</span>
            </li>
          </ol>
        </div>

        <RouterLink class="dispatch-link" to="/heroes">🛡️ Back to heroes →</RouterLink>
      </template>
    </template>
  </div>
</template>

<style scoped>
.boss-container {
  background-color: rgba(0, 0, 51, 0.7);
  border-radius: 1rem;
  padding: 1.5rem;
  margin: 1rem 0;
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 0 20px rgba(255, 80, 80, 0.2);
  animation: fadeIn 1s;
  backdrop-filter: blur(5px);
}
.boss-title { color: #fff; font-size: 1.8rem; margin-bottom: 1.25rem; text-align: center; text-shadow: 0 0 8px rgba(255,120,120,0.5); }
.gate-card { padding: 1rem; border-radius: 0.85rem; border: 1px solid rgba(255,255,255,0.12); background: rgba(255,255,255,0.04); text-align: center; }
.gate-title { margin: 0; color: #fff; font-weight: 700; }
.boss-card { background: rgba(255,255,255,0.04); border-radius: 0.85rem; padding: 1rem; margin-bottom: 1rem; text-align: center; }
.boss-name { color: #ffcccc; font-size: 1.3rem; font-weight: 700; margin-bottom: 0.4rem; }
.boss-stats { color: #ccccff; font-size: 0.9rem; margin-bottom: 0.5rem; }
.board { color: #fff; font-size: 0.9rem; }
.attack-card { background: rgba(255,255,255,0.04); border-radius: 0.85rem; padding: 0.85rem 1rem; margin-bottom: 1rem; }
.prod-title { color: #ccccff; font-size: 0.9rem; margin-bottom: 0.4rem; }
.attack-row { display: flex; gap: 0.5rem; align-items: center; }
.hero-select { flex: 1; background: rgba(0,0,40,0.8); color: #fff; border: 1px solid rgba(255,255,255,0.15); border-radius: 0.4rem; font-size: 0.85rem; padding: 0.4rem; }
.result-card { background: rgba(255,255,255,0.04); border-radius: 0.85rem; padding: 0.85rem 1rem; margin-bottom: 1rem; }
.result-head { font-weight: 700; margin-bottom: 0.5rem; color: #ffddaa; }
.rounds { margin: 0; padding-left: 1.1rem; color: #ccccff; font-size: 0.78rem; max-height: 9rem; overflow-y: auto; }
.round { margin-bottom: 0.2rem; }
.hp { color: #8888aa; }
.dispatch-link { display: block; text-align: center; color: #aaddff; text-decoration: none; padding: 0.6rem; }
.info-text { color: #ccccff; font-size: 0.9rem; text-align: center; padding: 0.5rem 0; }
.error-text { color: #ff6666; font-size: 0.88rem; text-align: center; padding: 0.5rem 0; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
</style>
