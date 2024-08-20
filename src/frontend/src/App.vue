<template>
  <div class="cosmos">
    <div v-for="(star, index) in stars" :key="index" class="star" :style="star"></div>
    <div class="content-wrapper">
      <RouterView />
    </div>
    <div class="solar-system">
      <div class="sun">
        <div class="sun-core"></div>
        <div class="sun-rays"></div>
      </div>
      <div class="planet earth"></div>
      <div class="planet mars"></div>
    </div>
    <div class="ufo" :style="ufoStyle"></div>
    <MainMenu />
    <ClosingConfirmation />
    <ExpandedViewport />
  </div>
</template>

<script>
import { ref, onMounted, computed } from "vue";
import { ClosingConfirmation, ExpandedViewport } from "vue-tg";
import MainMenu from "./components/nested/MainMenu.vue";

export default {
  name: "CubeWorldsMainPage",
  components: {
    MainMenu,
    ClosingConfirmation,
    ExpandedViewport,
  },
  setup() {
    const stars = ref([]);
    const ufoPosition = ref({ x: 0, y: 0 });

    const ufoStyle = computed(() => ({
      left: `${ufoPosition.value.x}%`,
      top: `${ufoPosition.value.y}%`,
    }));

    onMounted(() => {
      stars.value = Array.from({ length: 200 }, () => ({
        top: `${Math.random() * 100}%`,
        left: `${Math.random() * 100}%`,
        animationDuration: `${Math.random() * 3 + 1}s`,
        animationDelay: `${Math.random() * 2}s`,
      }));

      setInterval(() => {
        ufoPosition.value = {
          x: Math.random() * 100,
          y: Math.random() * 100,
        };
      }, 5000);
    });

    return { stars, ufoStyle };
  },
};
</script>

<style scoped>
.cosmos {
  position: relative;
  width: 100%;
  height: 100vh;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  background-color: #000033;
}

.content-wrapper {
  position: relative;
  z-index: 10;
  width: 100%;
  height: calc(100% - 60px);
  overflow: auto;
  padding: 2rem;
  box-sizing: border-box;
}

.star {
  position: fixed;
  width: 2px;
  height: 2px;
  background-color: #fff;
  border-radius: 50%;
  animation: twinkle 1s infinite alternate;
}

@keyframes twinkle {
  0% {
    opacity: 0.5;
    transform: scale(1);
  }
  100% {
    opacity: 1;
    transform: scale(1.5);
  }
}

.solar-system {
  position: fixed;
  bottom: 70%;
  left: 30%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.5s ease;
}

.sun {
  width: 100px;
  height: 100px;
  position: relative;
}

.sun-core {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background: radial-gradient(circle, #ff9933 0%, #ff6600 100%);
  box-shadow: 0 0 60px #ff9933, 0 0 100px #ff6600;
  animation: pulse 4s infinite alternate;
}

.sun-rays {
  position: absolute;
  top: -20%;
  left: -20%;
  right: -20%;
  bottom: -20%;
  background: radial-gradient(
    circle,
    rgba(255, 153, 51, 0.3) 0%,
    rgba(255, 102, 0, 0) 70%
  );
  animation: rotate 20s linear infinite;
}

.planet {
  position: absolute;
  border-radius: 50%;
}

.earth {
  width: 7px;
  height: 7px;
  background-color: #3366ff;
  left: 50px;
  animation: orbit 20s linear infinite;
}

.mars {
  width: 30px;
  height: 30px;
  background-color: #ff6666;
  left: 70px;
  animation: orbit 30s linear infinite;
}

.ufo {
  position: fixed;
  width: 60px;
  height: 30px;
  background-color: #000000 0;
  border-radius: 50% 50% 0 0;
  transition: all 2s ease;
  z-index: 20;
}

.ufo::before {
  content: "";
  position: absolute;
  bottom: -10px;
  left: 50%;
  transform: translateX(-50%);
  width: 20px;
  height: 5px;
  background-color: #cccccc;
  border-radius: 0 0 10px 10px;
}

@keyframes pulse {
  0%,
  100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.05);
  }
}

@keyframes rotate {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

@keyframes orbit {
  0% {
    transform: rotate(0deg) translateX(100px) rotate(0deg);
  }
  100% {
    transform: rotate(360deg) translateX(100px) rotate(-360deg);
  }
}
</style>
