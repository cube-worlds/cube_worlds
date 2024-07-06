<template>
  <h1>Cube Worlds Clicker</h1>

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
import { useWebApp, useWebAppHapticFeedback, MainButton, useWebAppPopup } from "vue-tg";
import { useAuth } from "../composables/use-auth";
import { Ref, onMounted, ref } from "vue";
import { useFluent } from "fluent-vue";
import { enBundle, ruBundle } from "../fluent.js";
import { useUserStore } from "../stores/userStore.js";

const fluent = useFluent();
const { $t } = useFluent();
const userStore = useUserStore()

function getUserIdFromRefString(refString: string): number | undefined {
  const match = refString.match(/ref_(\d+)/);
  if (match && match[1]) {
    return parseInt(match[1], 10);
  }
  return undefined;
}

onMounted(async () => {
  const initData = useWebApp().initDataUnsafe;
  const webAppUser = initData.user;
  if (webAppUser) {
    let referId = undefined;
    const start_param = initData.start_param;
    if (start_param) {
      referId = getUserIdFromRefString(start_param);
      console.log("start_param:", start_param);
    }
    const { user, error, login } = useAuth(useWebApp().initData, webAppUser.id, referId);
    await login();
    console.log(user.value ? user.value : error.value);

    const lang = user.value.language;
    fluent.bundles.value = [lang === "ru" ? ruBundle : enBundle];

    if (user.value) {
      userStore.setUser(user.value);
    }
  }
});

const { impactOccurred } = useWebAppHapticFeedback();

const count = ref(0);
const messages: Ref<
  {
    id: number;
    x: number;
    y: number;
    value: number;
  }[]
> = ref([]);

const tap = (value: number, event: MouseEvent) => {
  const impacts = ["light", "medium", "heavy", "rigid", "soft"];
  const random = Math.floor(Math.random() * impacts.length);
  const randomImpact = impacts[random] as "light" | "medium" | "heavy" | "rigid" | "soft";
  impactOccurred(randomImpact);
  const add = value * (random === 0 ? 1 : random);
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
    const index = messages.value.findIndex((m) => m.id === message.id);
    if (index !== -1) {
      messages.value.splice(index, 1);
    }
  }, 1000);
};

const popup = useWebAppPopup();

function showAlert() {
  if (count.value < 30) {
    return;
  }
  popup.showPopup(
    {
      title: $t("clicker-no-title"),
      message: $t("clicker-no"),
      buttons: [
        {
          id: "share",
          type: "default",
          text: "Share",
        },
        {
          id: "close",
          type: "default",
          text: "Close",
        },
      ],
    },
    (buttonId: string) => {
      switch (buttonId) {
        case "share":
          const text = $t("clicker-share-text");
          const user = userStore.user;
          console.log(user);
          let startParam = "";
          if (user?.id) {
            startParam = `?startapp=ref_${user.id}`;
          }
          const url = `https://t.me/cube_worlds_bot/clicker${startParam}`;
          const shareLink =
            "https://t.me/share/url?url=" +
            encodeURIComponent(url) +
            "&text=" +
            encodeURIComponent(text);
          return open(shareLink);
        case "close":
          return;
      }
    }
  );
}
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
  color: white;
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
