<script setup lang="ts">
import { useWebApp, useWebAppHapticFeedback } from "vue-tg";
import { useAuth } from "../composables/use-auth";
import { onMounted } from "vue";

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

function tap() {
  const impacts = ["light", "medium", "heavy", "rigid", "soft"];
  const randomImpact = impacts[Math.floor(Math.random() * impacts.length)] as
    | "light"
    | "medium"
    | "heavy"
    | "rigid"
    | "soft";
  impactOccurred(randomImpact);
}
</script>

<template>
  <h1>Cube Worlds Project</h1>

  <div class="card">
    <div class="cube-container">
      <div class="cube" @click="tap">
        <div class="front">CUBE</div>
        <div class="back">WORLDS</div>
        <div class="right">PROJECT</div>
        <div class="left">RPG GAME</div>
        <div class="top">TELEGRAM</div>
        <div class="bottom">TON</div>
      </div>
    </div>
    <!-- <button type="button" @click="increment">Count is {{ count }}</button>
    <p>
      Edit
      <code>components/HelloWorld.vue</code> to test HMR
    </p> -->
    <!-- <MainButton :progress="true" :text="`Count is ${count}`" @click="increment" />
    <SettingsButton @click="increment" /> -->

    <!-- <RouterLink to="/faq">Go to FAQ</RouterLink> -->
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
  border: 2px solid rgb(48, 182, 162);
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
