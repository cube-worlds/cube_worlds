<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { useUserStore } from '../stores/userStore.js'

interface Hero { id: string, heroClass: string, level: number }
interface CombatRound { attacker: 'hero' | 'enemy', damage: number, heroHp: number, enemyHp: number }
interface Loot { gold: number, iron: number, mana: number, food: number }
interface MatchRow {
  id: string
  mode: 'arena' | 'raid'
  youAttacked: boolean
  youWon: boolean | null
  ratingDelta: number | null
  opponent: { name: string, heroClass: string, level: number }
  loot: Loot
  at: string | null
}
interface PvpStatus {
  rating: number
  wins: number
  losses: number
  shieldUntil: string | null
  raidsLeft: number
  arenaEntryCube: string
  raidStakeCube: string
  raidFoodUpkeep: number
  matches: MatchRow[]
}
interface FightResult {
  mode: 'arena' | 'raid'
  win: boolean
  rounds: CombatRound[]
  ratingDelta: number
  xpGained?: number
  loot?: Loot
  stakeReturned?: boolean
  opponent: { name: string, heroClass: string, level: number }
}

const userStore = useUserStore()
const status = ref<PvpStatus | null>(null)
const heroes = ref<Hero[]>([])
const chosenHero = ref('')
const loadError = ref('')
const actionError = ref('')
const isLoading = ref(false)
const fighting = ref(false)
const lastResult = ref<FightResult | null>(null)

const lootText = computed(() => {
  const l = lastResult.value?.loot
  if (!l) return ''
  const parts: string[] = []
  if (l.gold) parts.push(`${l.gold} 🪙`)
  if (l.iron) parts.push(`${l.iron} ⚙️`)
  if (l.mana) parts.push(`${l.mana} 🔮`)
  if (l.food) parts.push(`${l.food} 🍖`)
  return parts.join(' · ')
})

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
    const s = await post<PvpStatus & { error?: string }>('/api/game/pvp', {})
    if (s.error) { loadError.value = s.error; return }
    status.value = s
    const list = await post<{ heroes?: Hero[], error?: string }>('/api/game/heroes', {})
    if (!list.error) {
      heroes.value = list.heroes ?? []
      if (!chosenHero.value && heroes.value.length) chosenHero.value = heroes.value[0].id
    }
  } catch (err) {
    loadError.value = 'Failed to load the arena.'
    console.error('Error fetching pvp status:', err)
  } finally {
    isLoading.value = false
  }
}

async function fight(kind: 'arena' | 'raid') {
  if (!userStore.initData || !chosenHero.value) return
  fighting.value = true
  actionError.value = ''
  lastResult.value = null
  const url = kind === 'arena' ? '/api/game/arena/fight' : '/api/game/raid/attack'
  try {
    const data = await post<FightResult & { error?: string }>(url, { heroId: chosenHero.value })
    if (data.error) { actionError.value = data.error; return }
    lastResult.value = data
    await refresh()
  } catch (err) {
    actionError.value = kind === 'arena' ? 'Failed to enter the arena.' : 'Failed to launch the raid.'
    console.error(`Error in ${kind}:`, err)
  } finally {
    fighting.value = false
  }
}

function lootLine(l: Loot): string {
  const parts: string[] = []
  if (l.gold) parts.push(`${l.gold}🪙`)
  if (l.iron) parts.push(`${l.iron}⚙️`)
  if (l.mana) parts.push(`${l.mana}🔮`)
  if (l.food) parts.push(`${l.food}🍖`)
  return parts.join(' ')
}

onMounted(() => { refresh() })
</script>

<template>
  <div class="arena-container">
    <h1 class="arena-title">Arena & Raids</h1>

    <div v-if="!userStore.initData" class="gate-card">
      <p class="gate-title">Authorizing profile...</p>
    </div>

    <template v-else>
      <div v-if="isLoading" class="info-text">Loading the arena...</div>
      <div v-else-if="loadError" class="error-text">{{ loadError }}</div>

      <template v-else-if="status">
        <div class="ladder-card">
          <div class="rating">🗡️ Rating: <strong>{{ status.rating }}</strong></div>
          <div class="record">{{ status.wins }}W · {{ status.losses }}L</div>
          <div v-if="status.shieldUntil" class="shield">🛡️ Shielded until {{ new Date(status.shieldUntil).toLocaleTimeString() }}</div>
          <div class="raids-left">Raids left today: {{ status.raidsLeft }}</div>
        </div>

        <div class="fight-card">
          <div class="prod-title">Pick a hero (questing heroes are unavailable)</div>
          <div class="fight-row">
            <select v-model="chosenHero" class="hero-select">
              <option v-for="h in heroes" :key="h.id" :value="h.id">{{ h.heroClass }} Lv{{ h.level }}</option>
            </select>
          </div>
          <div class="fight-row buttons">
            <button class="main-button" :disabled="fighting || !chosenHero" @click="fight('arena')">
              ⚔️ Arena ({{ status.arenaEntryCube }} CUBE)
            </button>
            <button class="main-button raid" :disabled="fighting || !chosenHero || status.raidsLeft === 0" @click="fight('raid')">
              🏴‍☠️ Raid ({{ status.raidStakeCube }} CUBE + {{ status.raidFoodUpkeep }} 🍖)
            </button>
          </div>
          <div v-if="heroes.length === 0" class="info-text">Recruit a hero first.</div>
        </div>

        <div v-if="actionError" class="error-text">{{ actionError }}</div>

        <div v-if="lastResult" class="result-card">
          <div class="result-head">
            {{ lastResult.win ? '🏆 Victory' : '💀 Defeat' }}
            vs {{ lastResult.opponent.name }} ({{ lastResult.opponent.heroClass }} Lv{{ lastResult.opponent.level }})
            · {{ lastResult.ratingDelta > 0 ? '+' : '' }}{{ lastResult.ratingDelta }} rating
            <span v-if="lastResult.xpGained">· +{{ lastResult.xpGained }} XP</span>
          </div>
          <div v-if="lastResult.mode === 'raid'" class="raid-outcome">
            <span v-if="lastResult.win">Stake returned · plundered {{ lootText || 'nothing' }}</span>
            <span v-else>Stake forfeited</span>
          </div>
          <ol class="rounds">
            <li v-for="(r, i) in lastResult.rounds" :key="i" class="round">
              {{ r.attacker === 'hero' ? '🗡️ You' : '🛡️ Foe' }} hit for {{ r.damage }}
              <span class="hp">(you {{ r.heroHp }} / foe {{ r.enemyHp }})</span>
            </li>
          </ol>
        </div>

        <div v-if="status.matches.length" class="history-card">
          <div class="prod-title">Recent battles</div>
          <ul class="history">
            <li v-for="m in status.matches" :key="m.id" class="history-row">
              <span>{{ m.mode === 'arena' ? '⚔️' : '🏴‍☠️' }}</span>
              <span v-if="m.youAttacked">You attacked {{ m.opponent.name }}</span>
              <span v-else>{{ m.opponent.name }} {{ m.mode === 'raid' ? 'raided you' : 'fought you' }}</span>
              <span :class="m.youWon ? 'won' : 'lost'">{{ m.youWon ? 'won' : 'lost' }}</span>
              <span v-if="m.ratingDelta !== null" class="delta">{{ m.ratingDelta > 0 ? '+' : '' }}{{ m.ratingDelta }}</span>
              <span v-if="m.mode === 'raid' && (m.loot.gold || m.loot.iron || m.loot.mana || m.loot.food)" class="loot">
                {{ m.youAttacked ? '+' : '-' }}{{ lootLine(m.loot) }}
              </span>
            </li>
          </ul>
        </div>

        <RouterLink class="dispatch-link" to="/heroes">🛡️ Manage heroes →</RouterLink>
      </template>
    </template>
  </div>
</template>

<style scoped>
.arena-container {
  background-color: rgba(0, 0, 51, 0.7);
  border-radius: 1rem;
  padding: 1.5rem;
  margin: 1rem 0;
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 0 20px rgba(120, 160, 255, 0.2);
  animation: fadeIn 1s;
  backdrop-filter: blur(5px);
}
.arena-title { color: #fff; font-size: 1.8rem; margin-bottom: 1.25rem; text-align: center; text-shadow: 0 0 8px rgba(120,160,255,0.5); }
.gate-card { padding: 1rem; border-radius: 0.85rem; border: 1px solid rgba(255,255,255,0.12); background: rgba(255,255,255,0.04); text-align: center; }
.gate-title { margin: 0; color: #fff; font-weight: 700; }
.ladder-card { background: rgba(255,255,255,0.04); border-radius: 0.85rem; padding: 1rem; margin-bottom: 1rem; text-align: center; }
.rating { color: #aaddff; font-size: 1.2rem; font-weight: 700; }
.record { color: #ccccff; font-size: 0.9rem; margin-top: 0.25rem; }
.shield { color: #aaffcc; font-size: 0.85rem; margin-top: 0.25rem; }
.raids-left { color: #ccccff; font-size: 0.85rem; margin-top: 0.25rem; }
.fight-card { background: rgba(255,255,255,0.04); border-radius: 0.85rem; padding: 0.85rem 1rem; margin-bottom: 1rem; }
.prod-title { color: #ccccff; font-size: 0.9rem; margin-bottom: 0.4rem; }
.fight-row { display: flex; gap: 0.5rem; align-items: center; margin-bottom: 0.5rem; }
.fight-row.buttons { flex-wrap: wrap; }
.hero-select { flex: 1; background: rgba(0,0,40,0.8); color: #fff; border: 1px solid rgba(255,255,255,0.15); border-radius: 0.4rem; font-size: 0.85rem; padding: 0.4rem; }
.main-button.raid { background: linear-gradient(135deg, #803030, #aa4040); }
.result-card { background: rgba(255,255,255,0.04); border-radius: 0.85rem; padding: 0.85rem 1rem; margin-bottom: 1rem; }
.result-head { font-weight: 700; margin-bottom: 0.5rem; color: #ffddaa; }
.raid-outcome { color: #ccccff; font-size: 0.85rem; margin-bottom: 0.5rem; }
.rounds { margin: 0; padding-left: 1.1rem; color: #ccccff; font-size: 0.78rem; max-height: 9rem; overflow-y: auto; }
.round { margin-bottom: 0.2rem; }
.hp { color: #8888aa; }
.history-card { background: rgba(255,255,255,0.04); border-radius: 0.85rem; padding: 0.85rem 1rem; margin-bottom: 1rem; }
.history { list-style: none; margin: 0; padding: 0; font-size: 0.8rem; color: #ccccff; }
.history-row { display: flex; gap: 0.4rem; flex-wrap: wrap; padding: 0.25rem 0; border-bottom: 1px solid rgba(255,255,255,0.06); }
.won { color: #aaffcc; }
.lost { color: #ff9999; }
.delta { color: #aaddff; }
.loot { color: #ffddaa; }
.dispatch-link { display: block; text-align: center; color: #aaddff; text-decoration: none; padding: 0.6rem; }
.info-text { color: #ccccff; font-size: 0.9rem; text-align: center; padding: 0.5rem 0; }
.error-text { color: #ff6666; font-size: 0.88rem; text-align: center; padding: 0.5rem 0; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
</style>
