<template>
  <div class="task-container">
    <div v-if="refreshing" class="loading">
      <div class="planet-loader"></div>
      <p>Loading tasks...</p>
    </div>
    <div v-else-if="error" class="error">
      <p>Error: {{ error }}</p>
      <button @click="fetchTasks" class="retry-button">
        <span class="refresh-icon">↻</span> Retry
      </button>
    </div>
    <template v-else>
      <ul
        v-if="taskItems.length"
        class="task-list"
        @touchstart="startRefresh"
        @touchmove="moveRefresh"
        @touchend="endRefresh"
      >
        <li
          v-for="item in taskItems"
          :key="item.id"
          class="task-item"
          :class="{ 'task-completed': item.is_done }"
        >
          <div class="item-content">
            <img
              :src="item.icon"
              :alt="item.name"
              class="task-icon"
              @error="handleImageError"
            />
            <div class="task-text">
              <h3>{{ item.name }}</h3>
              <p>{{ truncateDescription(item.description) }}</p>
            </div>
          </div>
          <p class="task-points">{{ usdToPoints(item.payout) }} $CUBE</p>
          <button
            class="task-button"
            :disabled="item.is_done || loading"
            @click="handleClick(item)"
            :class="{ 'button-done': item.is_done, 'button-loading': loading }"
          >
            {{ getButtonLabel(item) }}
          </button>
        </li>
      </ul>
      <div v-else class="empty-state">
        <p>No available tasks found</p>
        <button
          @click="fetchTasks"
          class="refresh-button"
          :disabled="refreshing"
        >
          <span class="refresh-icon">↻</span> Scan Again
        </button>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts" name="Tasks">
import { ref, onMounted, Ref, watch } from 'vue'
import axios from "axios";
import useLoadingAndError from "../composables/useLoadingAndError";
import { usdToPoints } from "#root/common/helpers/points";
import { sleep } from "#root/common/helpers/time";
import { useUserStore } from "#web/stores/userStore";
import { useWebAppHapticFeedback } from "vue-tg";

const { impactOccurred } = useWebAppHapticFeedback();

interface TappAdsOffer {
  id: number;
  name: string;
  icon: string;
  description: string;
  url: string;
  payout: number;
  currency: string;
  is_done: boolean;
  click_postback: string;
  btn_label: string;
}

// Constants
const MAX_DESCRIPTION_LENGTH = 80;
const PULL_TO_REFRESH_THRESHOLD = 60;
const API_URL = "https://wallapi.tappads.io/v1/feed";
const REFRESH_DEBOUNCE_MS = 2000;

// API key from environment variables
const tappAdsKey: string = import.meta.env.VITE_APIKEY;
if (!tappAdsKey) {
  console.error("API key is missing from environment variables");
}

// Composables
const { loadingInstance, showError } = useLoadingAndError();
const userStore = useUserStore();

// Reactive state
const taskItems: Ref<TappAdsOffer[]> = ref([]);
const error = ref<string | null>(null);
const refreshing = ref(false);
const startY = ref(0);
const lastRefreshTime = ref(0);
const loading = ref(false);
const failedImages = ref(new Set<string>());

// Helpers
function escape(str: string): string {
  if (!str) return "";
  return String(str).replace(/[\\"']/g, "\\$&").replace(/\u0000/g, "\\0");
}

function truncateDescription(description: string): string {
  if (!description) return "";
  return description.length > MAX_DESCRIPTION_LENGTH
    ? `${description.substring(0, MAX_DESCRIPTION_LENGTH)}...`
    : description;
}

function getButtonLabel(item: TappAdsOffer): string {
  if (loading.value) return "Loading...";
  return item.is_done ? "Done" : item.btn_label || "Start";
}

function handleImageError(event: Event): void {
  const img = event.target as HTMLImageElement;
  if (img && img.src) {
    failedImages.value.add(img.src);
    img.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='50' height='50' viewBox='0 0 50 50'%3E%3Crect width='50' height='50' fill='%23333'/%3E%3Ctext x='25' y='25' font-family='Arial' font-size='12' fill='%23fff' text-anchor='middle' dominant-baseline='middle'%3ENo Image%3C/text%3E%3C/svg%3E";
  }
}

// Core functionality
function openLink(url: string): void {
  if (!url) {
    console.error("Invalid URL provided");
    return;
  }

  try {
    window.open(url, "_blank", "noopener,noreferrer");
    impactOccurred("light");
  } catch (err) {
    console.error("Failed to open URL:", err);
  }
}

const fetchTasks = async (): Promise<void> => {
  // Prevent multiple refreshes within a short period
  const now = Date.now();
  if (refreshing.value || now - lastRefreshTime.value < REFRESH_DEBOUNCE_MS) {
    return;
  }

  refreshing.value = true;
  loadingInstance.visible.value = true;
  error.value = null;

  try {
    if (!tappAdsKey) {
      throw new Error("API key is missing");
    }

    if (!userStore.user?.id) {
      throw new Error("User ID is required");
    }

    const response = await axios.get(API_URL, {
      params: {
        apikey: tappAdsKey,
        user_id: userStore.user.id,
        ip: userStore.user?.ip ?? "0.0.0.0",
        ua: escape(navigator.userAgent),
      },
      timeout: 10000, // 10 second timeout
    });

    if (!response.data || !Array.isArray(response.data)) {
      throw new Error("Invalid response format");
    }

    taskItems.value = response.data as TappAdsOffer[];
    lastRefreshTime.value = Date.now();
  } catch (err: any) {
    console.error("Error fetching tasks:", err);
    error.value = err.message || "Failed to load tasks";
    showError(err);
  } finally {
    loadingInstance.visible.value = false;
    refreshing.value = false;
  }
};

const handleClick = async (item: TappAdsOffer): Promise<void> => {
  if (!item || !item.url || item.is_done || loading.value) {
    return;
  }

  loading.value = true;

  try {
    loadingInstance.visible.value = true;
    openLink(item.url);

    await sleep(1000);

    const userId = userStore.user?.id;
    if (!userId) {
      throw new Error("User ID is required");
    }

    const ip = userStore.user?.ip ?? "0.0.0.0";
    const ua = escape(navigator.userAgent);
    const addParams = `&ip=${encodeURIComponent(ip)}&ua=${encodeURIComponent(ua)}&sub3=${encodeURIComponent(userId)}`;

    if (!item.click_postback) {
      throw new Error("No postback URL available");
    }

    const res = await axios.get(item.click_postback + addParams);

    if (res.data?.is_done === true) {
      item.is_done = true;

      if (userStore.user?.balance && res.data.payout) {
        const points = usdToPoints(res.data.payout ?? 0);
        userStore.setBalance(userStore.balance + points);
      }
    }
  } catch (err: any) {
    console.error("Error handling click:", err);
    showError(err);
  } finally {
    loadingInstance.visible.value = false;
    loading.value = false;
  }
};

// Pull to refresh functionality
const startRefresh = (e: TouchEvent): void => {
  startY.value = e.touches[0].clientY;
};

const moveRefresh = (e: TouchEvent): void => {
  const touch = e.touches[0];
  const pullDistance = touch.clientY - startY.value;

  if (pullDistance > PULL_TO_REFRESH_THRESHOLD && !refreshing.value) {
    fetchTasks();
  }
};

const endRefresh = (): void => {
  startY.value = 0;
};

// Lifecycle hooks
onMounted(() => {
  if (userStore.user) {
    fetchTasks();
  }
});

watch(
  () => userStore.user,
  (newUser: any) => {
    if (newUser) {
      fetchTasks();
    } else {
      taskItems.value = [];
    }
  }
);
</script>

<style scoped>
.task-container {
  max-height: 100vh;
  overflow-y: auto;
  background-color: rgba(0, 0, 51, 0.8);
  font-family: "Arial", sans-serif;
  color: #fff;
  padding: 10px;
  -webkit-overflow-scrolling: touch;
}

.task-list {
  list-style-type: none;
  padding: 0;
  margin: 0;
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
  position: relative;
}

.task-item:active {
  transform: scale(0.98);
}

.task-completed {
  opacity: 0.7;
  background-color: rgba(255, 255, 255, 0.05);
}

.item-content {
  display: flex;
  align-items: center;
  flex: 1;
  min-width: 0;
}

.task-icon {
  width: 50px;
  height: 50px;
  min-width: 50px;
  margin-right: 15px;
  border-radius: 50%;
  object-fit: cover;
  box-shadow: 0 0 10px rgba(255, 255, 255, 0.5);
  background-color: #333;
}

.task-text {
  min-width: 0;
  flex: 1;
}

.task-text h3 {
  margin: 0 0 5px 0;
  color: #fff;
  font-size: 16px;
  font-weight: bold;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.task-text p {
  margin: 0;
  color: #ccc;
  font-size: 14px;
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.task-points {
  margin: 0 10px;
  font-weight: bold;
  color: #66ff99;
  white-space: nowrap;
}

.task-button {
  padding: 8px 15px;
  background-color: rgba(51, 102, 255, 0.8);
  color: #fff;
  border: none;
  border-radius: 20px;
  font-size: 14px;
  font-weight: bold;
  min-width: 80px;
  transition: all 0.3s ease;
  cursor: pointer;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
}

.task-button:hover:not(:disabled) {
  background-color: rgba(51, 102, 255, 1);
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
}

.task-button:active:not(:disabled) {
  transform: translateY(0);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

.task-button:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.button-done {
  background-color: rgba(100, 100, 100, 0.5);
  color: #ccc;
}

.button-loading {
  background-color: rgba(51, 102, 255, 0.5);
  color: rgba(255, 255, 255, 0.8);
}

.empty-state {
  text-align: center;
  padding: 40px 20px;
  background-color: rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  box-shadow: 0 0 15px rgba(255, 255, 255, 0.1);
  margin: 20px 0;
}

.empty-state p {
  color: #ccc;
  margin-bottom: 20px;
  font-size: 16px;
}

.refresh-button, .retry-button {
  padding: 10px 20px;
  background-color: #3366ff;
  color: #ffffff;
  border: none;
  border-radius: 25px;
  font-size: 16px;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
}

.refresh-button:hover:not(:disabled),
.retry-button:hover {
  background-color: #4d79ff;
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
}

.refresh-button:active:not(:disabled),
.retry-button:active {
  transform: translateY(0);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

.refresh-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.refresh-icon {
  margin-right: 8px;
  font-size: 18px;
  animation: none;
}

.refresh-button:disabled .refresh-icon {
  animation: spin 1s linear infinite;
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
  margin: 20px 0;
  padding: 20px;
}

.planet-loader {
  width: 50px;
  height: 50px;
  border-radius: 50%;
  background: linear-gradient(45deg, #3366ff, #ff6666);
  animation: orbit 2s linear infinite;
  margin-bottom: 15px;
}

.error p {
  color: #ff6666;
  font-weight: bold;
  margin-bottom: 15px;
  text-align: center;
}

@keyframes orbit {
  0% {
    transform: rotate(0deg) translateX(30px) rotate(0deg);
  }
  100% {
    transform: rotate(360deg) translateX(30px) rotate(-360deg);
  }
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

/* Media queries for responsiveness */
@media (max-width: 768px) {
  .task-item {
    flex-direction: column;
    align-items: flex-start;
  }

  .task-points {
    margin: 10px 0;
  }

  .task-button {
    align-self: flex-end;
    margin-top: 10px;
  }
}

@media (max-width: 480px) {
  .task-container {
    padding: 5px;
  }

  .task-item {
    padding: 10px;
  }

  .task-text h3 {
    font-size: 14px;
  }

  .task-text p {
    font-size: 12px;
  }
}
</style>
