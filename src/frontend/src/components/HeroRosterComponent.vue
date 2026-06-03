<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
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
interface StatBonus { hp: number, atk: number, def: number }
interface EquipItem {
  id: string
  slot: string
  rarity: string
  bonus: StatBonus
  equippedHeroId: string | null
  nftMinted: boolean
}
interface Quest { id: string, heroId: string, endsAt: string, ready: boolean }
interface CombatRound { attacker: 'hero' | 'enemy', damage: number, heroHp: number, enemyHp: number }
interface DungeonResult { win: boolean, rounds: CombatRound[], loot: Bag, xpGained: number, alreadyRan: boolean }
interface QuestResult { loot: Bag, xpGained: number, drop: EquipItem | null, leveledUp: boolean, alreadyClaimed?: boolean }

const HERO_CLASSES = ['knight', 'mage', 'archer', 'rogue'] as const

const userStore = useUserStore()
const heroes = ref<Hero[]>([])
const items = ref<EquipItem[]>([])
const quests = ref<Quest[]>([])
const ranToday = ref(false)
const loadError = ref('')
const actionError = ref('')
const isLoading = ref(false)
const recruiting = ref<string | null>(null)
const running = ref<string | null>(null)
const busy = ref<string | null>(null)
const equipTarget = ref<Record<string, string>>({})
const lastResult = ref<DungeonResult | null>(null)
const lastQuest = ref<QuestResult | null>(null)
const now = ref(Date.now())
let clock: ReturnType<typeof setInterval> | undefined

async function post<T>(url: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ initData: userStore.initData, ...body }),
  })
  return res.json()
}

function questFor(heroId: string): Quest | undefined {
  return quests.value.find(q => q.heroId === heroId)
}

function equippedFor(heroId: string): EquipItem[] {
  return items.value.filter(i => i.equippedHeroId === heroId)
}

const inventory = computed(() => items.value.filter(i => !i.equippedHeroId))

function remaining(endsAt: string): string {
  const ms = new Date(endsAt).getTime() - now.value
  if (ms <= 0) return 'ready'
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  return `${h}h ${m}m`
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
    const eq = await post<{ items?: EquipItem[], error?: string }>('/api/game/equipment', {})
    if (!eq.error) items.value = eq.items ?? []
    const qs = await post<{ quests?: Quest[], error?: string }>('/api/game/quest', {})
    if (!qs.error) quests.value = qs.quests ?? []
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

async function startQuest(heroId: string) {
  if (!userStore.initData) return
  busy.value = heroId
  actionError.value = ''
  try {
    const data = await post<{ error?: string }>('/api/game/quest/start', { heroId })
    if (data.error) { actionError.value = data.error; return }
    await refresh()
  } catch (err) {
    actionError.value = 'Failed to start the quest.'
    console.error('Error starting quest:', err)
  } finally {
    busy.value = null
  }
}

async function claimQuest(quest: Quest) {
  if (!userStore.initData) return
  busy.value = quest.heroId
  actionError.value = ''
  lastQuest.value = null
  try {
    const data = await post<QuestResult & { error?: string }>('/api/game/quest/claim', { questId: quest.id })
    if (data.error) { actionError.value = data.error; return }
    lastQuest.value = data
    await refresh()
  } catch (err) {
    actionError.value = 'Failed to claim the quest.'
    console.error('Error claiming quest:', err)
  } finally {
    busy.value = null
  }
}

async function equip(itemId: string) {
  const heroId = equipTarget.value[itemId]
  if (!userStore.initData || !heroId) return
  busy.value = itemId
  actionError.value = ''
  try {
    const data = await post<{ error?: string }>('/api/game/equipment/equip', { equipmentId: itemId, heroId })
    if (data.error) { actionError.value = data.error; return }
    await refresh()
  } catch (err) {
    actionError.value = 'Failed to equip.'
    console.error('Error equipping item:', err)
  } finally {
    busy.value = null
  }
}

async function unequip(itemId: string) {
  if (!userStore.initData) return
  busy.value = itemId
  actionError.value = ''
  try {
    const data = await post<{ error?: string }>('/api/game/equipment/unequip', { equipmentId: itemId })
    if (data.error) { actionError.value = data.error; return }
    await refresh()
  } catch (err) {
    actionError.value = 'Failed to unequip.'
    console.error('Error unequipping item:', err)
  } finally {
    busy.value = null
  }
}

onMounted(() => {
  refresh()
  clock = setInterval(() => { now.value = Date.now() }, 30_000)
})
onUnmounted(() => { if (clock) clearInterval(clock) })
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

            <div v-if="equippedFor(h.id).length" class="gear-line">
              <span v-for="g in equippedFor(h.id)" :key="g.id" class="gear-chip" :class="`r-${g.rarity}`">
                {{ g.slot }} ·
                <span v-if="g.bonus.atk">+{{ g.bonus.atk }}⚔</span>
                <span v-if="g.bonus.def">+{{ g.bonus.def }}🛡</span>
                <span v-if="g.bonus.hp">+{{ g.bonus.hp }}❤</span>
                <button class="link-btn" :disabled="busy === g.id" @click="unequip(g.id)">✕</button>
              </span>
            </div>

            <div class="hero-actions">
              <template v-if="questFor(h.id)">
                <button
                  v-if="questFor(h.id)!.ready || remaining(questFor(h.id)!.endsAt) === 'ready'"
                  class="main-button run-btn"
                  :disabled="busy === h.id"
                  @click="claimQuest(questFor(h.id)!)"
                >
                  <span v-if="busy === h.id">Claiming...</span><span v-else>🎁 Claim quest</span>
                </button>
                <span v-else class="questing">⏳ Questing — {{ remaining(questFor(h.id)!.endsAt) }}</span>
              </template>
              <template v-else>
                <button
                  class="main-button run-btn"
                  :disabled="running === h.id || ranToday"
                  @click="runDungeon(h.id)"
                >
                  <span v-if="running === h.id">Fighting...</span>
                  <span v-else-if="ranToday">Dungeon done today</span>
                  <span v-else>⚔️ Daily dungeon</span>
                </button>
                <button
                  class="main-button ghost-btn"
                  :disabled="busy === h.id"
                  @click="startQuest(h.id)"
                >
                  <span v-if="busy === h.id">...</span><span v-else>🧭 8h quest</span>
                </button>
              </template>
            </div>
          </div>
        </div>

        <div v-if="inventory.length" class="recruit-card">
          <div class="prod-title">Inventory</div>
          <div class="inv-list">
            <div v-for="it in inventory" :key="it.id" class="inv-row">
              <span class="gear-chip" :class="`r-${it.rarity}`">
                {{ it.rarity }} {{ it.slot }} ·
                <span v-if="it.bonus.atk">+{{ it.bonus.atk }}⚔</span>
                <span v-if="it.bonus.def">+{{ it.bonus.def }}🛡</span>
                <span v-if="it.bonus.hp">+{{ it.bonus.hp }}❤</span>
              </span>
              <span class="inv-equip">
                <select v-model="equipTarget[it.id]" class="hero-select">
                  <option value="">— hero —</option>
                  <option v-for="h in heroes" :key="h.id" :value="h.id">{{ h.heroClass }} Lv{{ h.level }}</option>
                </select>
                <button class="main-button class-btn" :disabled="busy === it.id || !equipTarget[it.id]" @click="equip(it.id)">Equip</button>
              </span>
            </div>
          </div>
        </div>

        <div v-if="lastQuest" class="result-card">
          <div class="result-head win">🧭 Quest complete (+{{ lastQuest.xpGained }} XP{{ lastQuest.leveledUp ? ', level up!' : '' }})</div>
          <div class="prod-ready">
            Loot: +{{ lastQuest.loot.gold }}G {{ lastQuest.loot.iron }}I {{ lastQuest.loot.mana }}M {{ lastQuest.loot.food }}F
          </div>
          <div v-if="lastQuest.drop" class="prod-ready">🎉 Dropped: {{ lastQuest.drop.rarity }} {{ lastQuest.drop.slot }}!</div>
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

        <RouterLink class="dispatch-link" to="/boss">🐉 Raid the weekly boss →</RouterLink>
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
.hero-card { display: flex; flex-direction: column; gap: 0.5rem; padding: 0.7rem 1rem; border-radius: 0.85rem; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.04); }
.hero-head { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; }
.hero-name { color: #fff; font-weight: 700; font-size: 0.95rem; text-transform: capitalize; }
.hero-xp { color: #aaaacc; font-size: 0.75rem; }
.badge { margin-left: 0.25rem; }
.hero-actions { display: flex; gap: 0.5rem; flex-wrap: wrap; }
.run-btn { font-size: 0.85rem; padding: 0.45rem 0.9rem; }
.ghost-btn { font-size: 0.85rem; padding: 0.45rem 0.9rem; opacity: 0.85; }
.questing { color: #ffddaa; font-size: 0.82rem; align-self: center; }
.gear-line { display: flex; flex-wrap: wrap; gap: 0.35rem; }
.gear-chip { font-size: 0.72rem; color: #dde; background: rgba(255,255,255,0.06); border-radius: 0.5rem; padding: 0.15rem 0.45rem; text-transform: capitalize; }
.gear-chip.r-rare { color: #99ccff; }
.gear-chip.r-epic { color: #cc99ff; }
.gear-chip.r-legendary { color: #ffcc66; }
.link-btn { background: none; border: none; color: #ff9999; cursor: pointer; font-size: 0.7rem; margin-left: 0.2rem; padding: 0; }
.inv-list { display: flex; flex-direction: column; gap: 0.45rem; }
.inv-row { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; }
.inv-equip { display: flex; gap: 0.35rem; align-items: center; }
.hero-select { background: rgba(0,0,40,0.8); color: #fff; border: 1px solid rgba(255,255,255,0.15); border-radius: 0.4rem; font-size: 0.75rem; padding: 0.2rem; }
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
