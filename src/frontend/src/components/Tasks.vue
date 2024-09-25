<template>
  <div class="task-container">
    <div v-if="refreshing" class="loading">
      <div class="planet-loader"></div>
      <p>Loading...</p>
    </div>
    <div v-else-if="error" class="error">
      <p>Error: {{ error }}</p>
    </div>
    <template v-else>
      <ul
        v-if="taskItems.length"
        class="task-list"
        @touchstart="startRefresh"
        @touchmove="moveRefresh"
        @touchend="endRefresh"
      >
        <li v-for="item in taskItems" :key="item.id" class="task-item">
          <div class="item-content">
            <img :src="item.icon" :alt="item.name" class="task-icon" />
            <div class="task-text">
              <h3>{{ item.name }}</h3>
              <p>{{ item.description }}</p>
            </div>
          </div>
          <p>{{ usdToPoints(item.payout) }} $CUBE</p>
          <button
            class="task-button"
            :disabled="item.is_done"
            @click="handleClick(item)"
            :style="{
              cursor: item.is_done ? 'not-allowed' : 'pointer',
              color: item.is_done ? '#ccc' : '#fff',
            }"
          >
            {{ item.is_done ? "Done" : item.btn_label }}
          </button>
        </li>
      </ul>
      <div v-else class="empty-state">
        <p>No entities detected</p>
        <button @click="fetchTasks" class="refresh-button">
          <span class="refresh-icon">↻</span> Scan Again
        </button>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts" name="TasksComponent">
import { ref, onMounted, Ref, watch } from "vue"
import axios from "axios"
import useLoadingAndError from "../composables/useLoadingAndError"
import { usdToPoints } from "../../../bot/helpers/points"
import { sleep } from "../../../bot/helpers/time"
import { useUserStore } from "../stores/userStore"
import { useWebAppHapticFeedback } from "vue-tg"

const { impactOccurred } = useWebAppHapticFeedback()

function openLink(url: string) {
  window.open(url, "_blank", "noopener,noreferrer")
  impactOccurred("light")
}

interface TappAdsOffer {
  id: number
  name: string
  icon: string
  description: string
  url: string
  payout: number
  currency: string
  is_done: boolean
  click_postback: string
  btn_label: string
}

const tappAdsKey: string = import.meta.env.VITE_APIKEY
const { loadingInstance, showError } = useLoadingAndError()
const userStore = useUserStore()
const taskItems: Ref<TappAdsOffer[]> = ref([])
const error = ref(null)
const refreshing = ref(false)
const startY = ref(0)

function escape(str: string) {
  return (str + "").replace(/[\\"']/g, "\\$&").replace(/\u0000/g, "\\0")
}

const fetchTasks = async () => {
  if (refreshing.value) return
  refreshing.value = true
  loadingInstance.visible.value = true
  try {
    if (!tappAdsKey) {
      throw new Error("Something went wrong")
    }
    const response = await axios.get("https://wallapi.tappads.io/v1/feed", {
      params: {
        apikey: tappAdsKey,
        user_id: userStore.user?.id,
        ip: userStore.user?.ip ?? "0.0.0.0",
        ua: escape(navigator.userAgent),
      },
    })
    taskItems.value = response.data as TappAdsOffer[]
  } catch (err) {
    showError(err)
  } finally {
    loadingInstance.visible.value = false
    refreshing.value = false
  }
}

const handleClick = async (item: any) => {
  try {
    loadingInstance.visible.value = true
    openLink(item.url)
    await sleep(1000)
    const userId = userStore.user?.id
    const ip = userStore.user?.ip ?? "0.0.0.0"
    const ua = escape(navigator.userAgent)
    const addParams = `&ip=${ip}&ua=${ua}&sub2=${userId}`
    const res = await axios.get(item.click_postback + addParams)
    if (res.data.is_done === true) {
      item.is_done = true
    }
  } catch (err) {
    console.error("Error handling click:", err)
  } finally {
    loadingInstance.visible.value = false
  }
}

const startRefresh = (e: TouchEvent) => {
  startY.value = e.touches[0].clientY
}

const moveRefresh = (e: TouchEvent) => {
  const touch = e.touches[0]
  const pullDistance = touch.clientY - startY.value
  if (pullDistance > 50 && !refreshing.value) {
    fetchTasks()
  }
}

const endRefresh = () => {
  startY.value = 0
}

onMounted(() => {
  if (userStore.user) {
    fetchTasks()
  }
})

watch(
  () => userStore.user,
  () => {
    fetchTasks()
  }
)
</script>

<style scoped>
.task-container {
  max-height: 100vh;
  overflow-y: auto;
  background-color: rgba(0, 0, 51, 0.8);
  font-family: "Arial", sans-serif;
  color: #fff;
}

.task-list {
  list-style-type: none;
  padding: 0;
}

.task-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px;
  background-color: rgba(255, 255, 255, 0.1);
  margin-bottom: 15px;
  border-radius: 10px;
  box-shadow: 0 0 15px rgba(255, 255, 255, 0.1);
  transition: all 0.3s ease;
}

.task-item:hover {
  transform: translateY(-2px);
  box-shadow: 0 0 20px rgba(255, 255, 255, 0.2);
}

.item-content {
  display: flex;
  align-items: center;
}

.task-icon {
  width: 50px;
  height: 50px;
  margin-right: 15px;
  border-radius: 50%;
  object-fit: cover;
  box-shadow: 0 0 10px rgba(255, 255, 255, 0.5);
}

.task-text h3 {
  margin: 0 0 5px 0;
  color: #fff;
  font-size: 18px;
}

.task-text p {
  margin: 0;
  color: #ccc;
  font-size: 14px;
}

.task-button {
  padding: 8px 15px;
  background-color: rgba(255, 255, 255, 0.2);
  color: #fff;
  border: none;
  border-radius: 20px;
  font-size: 14px;
  font-weight: bold;
  transition: background-color 0.3s ease;
}

.empty-state {
  text-align: center;
  padding: 40px 20px;
  background-color: rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  box-shadow: 0 0 15px rgba(255, 255, 255, 0.1);
}

.empty-state p {
  color: #ccc;
  margin-bottom: 20px;
}

.refresh-button {
  padding: 10px 20px;
  background-color: #3366ff;
  color: #ffffff;
  border: none;
  border-radius: 25px;
  font-size: 16px;
  font-weight: bold;
  cursor: pointer;
  transition: background-color 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto;
}

.refresh-button:hover {
  background-color: #4d79ff;
}

.refresh-icon {
  margin-right: 8px;
  font-size: 18px;
}

.loading,
.error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 200px;
  background-color: rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  box-shadow: 0 0 15px rgba(255, 255, 255, 0.1);
}

.planet-loader {
  width: 50px;
  height: 50px;
  border-radius: 50%;
  background: linear-gradient(45deg, #3366ff, #ff6666);
  animation: orbit 2s linear infinite;
}

.error p {
  color: #ff6666;
  font-weight: bold;
}

@keyframes orbit {
  0% {
    transform: rotate(0deg) translateX(30px) rotate(0deg);
  }

  100% {
    transform: rotate(360deg) translateX(30px) rotate(-360deg);
  }
}
</style>
