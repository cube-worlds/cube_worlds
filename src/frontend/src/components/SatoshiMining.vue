<script setup lang="ts">
import type { TonConnectUI } from '@tonconnect/ui'
import type { Ref } from 'vue'
import TonWeb from 'tonweb'
import { computed, inject, onMounted, ref } from 'vue'
import { useRetry } from '../composables/useRetry'

const tonConnectUI = inject<Ref<TonConnectUI | null>>('tonConnectUI')
const { retry } = useRetry()

const contractAddress = 'EQCkdx5PSWjj-Bt0X-DRCfNev6ra1NVv9qqcu-W2-SaToSHI'

const provider = new TonWeb.HttpProvider('https://toncenter.com/api/v2/jsonRPC')
const tonweb = new TonWeb(provider)

const miningData = ref<any>(null)
const jettonData = ref<any>(null)
const timeText = ref('00:00')
const isLoading = ref(false)

function fromNano(n: number | bigint | string) {
  return TonWeb.utils.fromNano(n.toString())
}

function formatNumber(num: number | string) {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 2,
  }).format(Number(num))
}

const formattedSubsidy = computed(() =>
  miningData.value && miningData.value.subsidy
    ? `${fromNano(miningData.value.subsidy)} $SATOSHI`
    : '…',
)

const isMiningDisabled = computed(() => {
  if (isLoading.value) return true
  if (!miningData.value) return true
  return miningData.value.probability < 10
})

const reward = computed(() => {
  const data = miningData.value
  if (
    !data ||
    typeof data.last_block_time !== 'number' ||
    data.subsidy == null
  ) {
    return '…'
  }
  const differenceInMs = Date.now() - data.last_block_time * 1000
  const minutes = Math.floor(differenceInMs / 60000)
  const blocks = Math.max(1, Math.floor(minutes / 10))
  try {
    const subsidyNano = BigInt(data.subsidy.toString())
    const totalNano = subsidyNano * BigInt(blocks)
    return fromNano(totalNano.toString())
  } catch {
    return '…'
  }
})

const maxSupply = 21_000_000 // 21M SATOSHI

const formattedSupply = computed(() => {
  if (!jettonData.value?.total_supply) return '…'
  const supply = Number(fromNano(jettonData.value.total_supply))
  const percent = (supply / maxSupply) * 100
  return `${formatNumber(supply)} (${percent.toFixed(2)}%)`
})

const rights = computed(() =>
  jettonData.value?.admin_address ===
  '0:0000000000000000000000000000000000000000000000000000000000000000'
    ? '✅'
    : '❌',
)

async function submitMining() {
  if (isMiningDisabled.value) return
  const ui = tonConnectUI?.value
  if (!ui) return
  const wallet = ui.wallet
  if (!wallet) {
    ui.openModal()
    return
  }
  const cell = new TonWeb.boc.Cell()
  cell.bits.writeUint(0, 32)
  cell.bits.writeString('F')
  const payload = btoa(
    String.fromCharCode(...new Uint8Array(await cell.toBoc())),
  )
  await ui.sendTransaction({
    validUntil: Math.floor(Date.now() / 1000) + 120,
    messages: [
      {
        address: contractAddress,
        amount: '60000000',
        payload,
      },
    ],
  })
}

async function fetchJetton() {
  const res = await retry(() =>
    tonweb.provider.call2(contractAddress, 'get_jetton_data'),
  )
  if (!res) {
    jettonData.value = null
    return
  }
  jettonData.value = {
    total_supply: res[0],
    // mintable: result[1],
    admin_address: res[2],
    // content: result[3],
    // wallet_code: result[4],
  }
}

async function fetchMining() {
  const res = await retry(() =>
    tonweb.provider.call2(contractAddress, 'get_mining_data'),
  )
  if (!res) {
    miningData.value = null
    return
  }
  miningData.value = {
    last_block: Number.parseInt(res[0]),
    last_block_time: Number.parseInt(res[1]),
    attempts: Number.parseInt(res[2]),
    subsidy: res[3],
    probability: Number.parseInt(res[4]),
  }
}

function updateTimer() {
  if (!miningData.value || !miningData.value.last_block_time) {
    timeText.value = '00:00'
    return
  }

  const diff = Date.now() - miningData.value.last_block_time * 1000
  const m = Math.floor(diff / 60000)
  const s = Math.floor((diff % 60000) / 1000)

  timeText.value = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

async function updateStats() {
  await Promise.all([fetchJetton(), fetchMining()])

  if (!miningData.value || !miningData.value.last_block_time) {
    return
  }
  if ((window as any).updateStatsTimeout) {
    clearTimeout((window as any).updateStatsTimeout)
  }

  const blockTimeMs = miningData.value.last_block_time * 1000
  const now = Date.now()
  const timeSinceBlock = now - blockTimeMs

  const delay = 10000
  const msToNextMinute = 60000 - (timeSinceBlock % 60000) + delay

  ;(window as any).updateStatsTimeout = setTimeout(updateStats, msToNextMinute)
}

onMounted(() => {
  updateStats()
  setInterval(updateTimer, 1000)
})
</script>

<template>
  <div class="mining-container">
    <div class="card">
      <h1>$SATOSHI Mining</h1>

      <button
        class="main-button"
        :disabled="isMiningDisabled"
        @click="submitMining"
      >
        Press F
      </button>

      <p class="desc">
        By pressing F you get
        <b>~{{ miningData?.probability ?? '…' }}%</b> chance to mine
        <b>{{ reward }} $SATOSHI</b> (costs 0.06 TON)
      </p>
    </div>

    <div class="grid">
      <!-- Mining Info -->
      <div class="card">
        <h3>Mining Info</h3>

        <div class="stat">
          <span>Block</span>
          <span>{{ miningData?.last_block ?? '…' }}</span>
        </div>

        <div class="stat">
          <span>Attempts</span>
          <span>{{ miningData?.attempts ?? '…' }}</span>
        </div>

        <div class="stat">
          <span>Subsidy</span>
          <span>{{ formattedSubsidy }}</span>
        </div>

        <div class="stat">
          <span>Probability</span>
          <span>{{ miningData?.probability ?? '…' }}%</span>
        </div>

        <div class="stat">
          <span>Time since block</span>
          <span>{{ timeText }}</span>
        </div>
      </div>

      <!-- Token Info -->
      <div class="card">
        <h3>Token Info</h3>

        <div class="stat"><span>Symbol</span><span>SATOSHI</span></div>

        <div class="stat">
          <span>Total Supply</span><span>{{ formattedSupply }}</span>
        </div>

        <div class="stat"><span>Decimals</span><span>9</span></div>

        <div class="stat">
          <span>Rights revoked</span>
          <span :title="rights ? 'Will be revoked soon' : ''">{{
            rights
          }}</span>
        </div>

        <div class="stat">
          <span>Contract</span>
          <a
            :href="`https://tonviewer.com/${contractAddress}`"
            target="_blank"
            class="contract"
          >
            {{ contractAddress }}
          </a>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.mining-container {
  padding: 12px;
  width: 100%;
  max-width: 500px;
  margin: 0 auto;
}

.card {
  background: rgba(0, 0, 40, 0.7);
  border-radius: 12px;
  padding: 14px;
  margin-bottom: 12px;
  backdrop-filter: blur(4px);
  border: 1px solid rgba(255, 255, 255, 0.06);
}

.grid {
  display: grid;
  gap: 12px;
}

.stat {
  display: flex;
  justify-content: space-between;
  padding: 4px 0;
  color: #fff;
  font-size: 14px;
}

.contract {
  font-size: 11px;
  display: block;
  margin-left: auto;
  color: #9cc2ff;
  word-break: break-all;
}

.desc {
  margin-top: 6px;
  font-size: 14px;
  opacity: 0.85;
}
</style>
