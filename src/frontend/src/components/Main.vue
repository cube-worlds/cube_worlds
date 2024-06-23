<script setup lang="ts">
import { useWebApp, useWebAppHapticFeedback, MainButton, useWebAppPopup } from "vue-tg";
import { useAuth } from "../composables/use-auth";
import { onMounted, ref } from "vue";

defineProps<{ msg?: string }>();

onMounted(async () => {
  const webAppUser = useWebApp().initDataUnsafe.user;
  if (webAppUser) {
    const { user, error, login } = useAuth(useWebApp().initData, webAppUser.id);
    await login();
    console.log(user.value, error.value);
  }
});

const { impactOccurred } = useWebAppHapticFeedback();

const count = ref(0);

function tap(value: number) {
  const impacts = ["light", "medium", "heavy", "rigid", "soft"];
  const random = Math.floor(Math.random() * impacts.length);
  const randomImpact = impacts[random] as "light" | "medium" | "heavy" | "rigid" | "soft";
  count.value += value * random;
  impactOccurred(randomImpact);
}

const popup = useWebAppPopup();

function showAlert() {
  popup.showPopup(
    {
      title: "It's a joke!",
      message: "NO, NO, NO! NO ANY F**KING CLICKERS WILL BE HERE AT ALL!",
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
          const text = "New awesome clicker";
          const url = "https://t.me/cube_worlds_bot/clicker"; // TODO: ADD referal ?
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

<template>
  <h1>Cube Worlds Project</h1>

  <div class="card">
    <div class="cube-container">
      <div class="cube">
        <div class="front" @click="tap(1)">CUBE</div>
        <div class="back" @click="tap(2)">WORLDS</div>
        <div class="right" @click="tap(1)">PROJECT</div>
        <div class="left" @click="tap(10)">RPG GAME</div>
        <div class="top" @click="tap(4)">TELEGRAM</div>
        <div class="bottom" @click="tap(3)">TON</div>
      </div>
    </div>

    <MainButton :text="`Balance: ${count} $CUBE`" @click="showAlert" />
  </div>
</template>

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
}
.cube {
  width: 200px;
  height: 200px;
  position: relative;
  transform-style: preserve-3d;
  animation: rotate 20s infinite linear;
}
.cube div {
  position: absolute;
  width: 200px;
  height: 200px;
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
</style>
