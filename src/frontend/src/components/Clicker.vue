<template>
  <h1>{{ $t("clicker-title") }}</h1>

  <div class="card">
    <div class="cube-container">
      <div class="cube">
        <div class="front" @click="(event) => tap(1, event)">CUBE</div>
        <div class="back" @click="(event) => tap(2, event)">WORLDS</div>
        <div class="right" @click="(event) => tap(1, event)">PROJECT</div>
        <div class="left" @click="(event) => tap(5, event)">RPG GAME</div>
        <div class="top" @click="(event) => tap(4, event)">TELEGRAM</div>
        <div class="bottom" @click="(event) => tap(3, event)">TON</div>
      </div>

      <transition-group name="float-message" tag="div" class="message-container">
        <div
          v-for="message in messages"
          :key="message.id"
          class="message"
          :style="{ left: `${message.x}px`, top: `${message.y}px` }"
        >
          +{{ message.value }}
        </div>
      </transition-group>
    </div>

    <MainButton :text="`Balance: ${count} $CUBE`" @click="showAlert" />
  </div>
</template>

<script setup lang="ts">
import { useWebAppHapticFeedback, MainButton, useWebAppPopup } from "vue-tg";
import { Ref, onMounted, onUnmounted, ref } from "vue";
import { useUserStore } from "../stores/userStore.js";
import { useFluent } from "fluent-vue";

const { $t } = useFluent();
const userStore = useUserStore();

onMounted(async () => {
  disableZoom();
});

onUnmounted(() => {
  restoreZoom();
});

const { impactOccurred } = useWebAppHapticFeedback();

const count = ref(0);
const messages: Ref<{ id: number; x: number; y: number; value: number }[]> = ref([]);

const tap = (value: number, event: MouseEvent) => {
  const impacts = ["light", "medium", "heavy", "rigid", "soft"] as const;
  const randomImpact = impacts[Math.floor(Math.random() * impacts.length)];
  impactOccurred(randomImpact);

  const multiplier = randomImpact === "light" ? 1 : impacts.indexOf(randomImpact) + 1;
  const add = value * multiplier;
  count.value += add;

  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
  const message = {
    id: Date.now(),
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
    value: add,
  };
  messages.value.push(message);

  setTimeout(() => {
    messages.value = messages.value.filter((m) => m.id !== message.id);
  }, 1000);
};

const popup = useWebAppPopup();

function showAlert() {
  if (count.value < 30) return;

  popup.showPopup(
    {
      title: $t("clicker-no-title"),
      message: $t("clicker-no"),
      buttons: [
        { id: "share", type: "default", text: "Share" },
        { id: "close", type: "default", text: "Close" },
      ],
    },
    (buttonId: string) => {
      if (buttonId === "share") {
        const text = $t("clicker-share-text");
        const user = userStore.user;
        const startParam = user?.id ? `?startapp=ref_${user.id}` : "";
        const url = `https://t.me/cube_worlds_bot/clicker${startParam}`;
        const shareLink = `https://t.me/share/url?url=${encodeURIComponent(
          url
        )}&text=${encodeURIComponent(text)}`;
        window.open(shareLink);
      }
    }
  );
}

const disableZoom = () => {
  const meta = document.createElement("meta");
  meta.name = "viewport";
  meta.content =
    "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no";
  document.head.appendChild(meta);
};

const restoreZoom = () => {
  const meta = document.querySelector('meta[name="viewport"]');
  if (meta) {
    document.head.removeChild(meta);
  }
};
</script>

<style scoped>
.card {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}
.cube-container {
  margin: 4rem 0;
  user-select: none;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;

  cursor: pointer;
  position: relative;
  font-size: 24px;
  display: flex;
  justify-content: center;
  align-items: center;
  width: 200px;
  height: 200px;
}
.cube {
  width: 100%;
  height: 100%;
  position: relative;
  transform-style: preserve-3d;
  animation: rotate 20s infinite linear;
}
.cube div {
  position: absolute;
  width: 100%;
  height: 100%;
  background: rgba(197, 197, 197, 0.1);
  border: 2px solid var(--tg-theme-link-color, #646cff);
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 36px;
  font-weight: bold;
  font-family: Psychic-Force, sans-serif;
  text-shadow: 2px 2px 0 #000;
  backface-visibility: visible;
  image-rendering: pixelated;
}

.front {
  transform: rotateY(0deg) translateZ(100px);
}
.back {
  transform: rotateY(180deg) translateZ(100px);
}
.right {
  transform: rotateY(90deg) translateZ(100px);
}
.left {
  transform: rotateY(-90deg) translateZ(100px);
}
.top {
  transform: rotateX(90deg) translateZ(100px);
}
.bottom {
  transform: rotateX(-90deg) translateZ(100px);
}

@keyframes rotate {
  0% {
    transform: rotateX(0) rotateY(0) rotateZ(0);
  }
  100% {
    transform: rotateX(360deg) rotateY(360deg) rotateZ(360deg);
  }
}

.message-container {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  overflow: hidden;
}

.message {
  position: absolute;
  font-size: 24px;
  color: var(--tg-theme-text-color);
  pointer-events: none;
  animation: float-up 1s ease-out;
}

@keyframes float-up {
  0% {
    opacity: 1;
    transform: translateY(0);
  }
  100% {
    opacity: 0;
    transform: translateY(-50px);
  }
}

.float-message-enter-active,
.float-message-leave-active {
  transition: opacity 0.5s ease, transform 0.5s ease;
}

.float-message-enter-from,
.float-message-leave-to {
  opacity: 0;
  transform: translateY(20px);
}
</style>
