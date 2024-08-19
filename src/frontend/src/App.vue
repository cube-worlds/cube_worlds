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
    </div>
    <Footer />
    <ClosingConfirmation />
    <ExpandedViewport />
  </div>
</template>

<script>
import { ref, onMounted } from "vue";
import { ClosingConfirmation, ExpandedViewport } from "vue-tg";
import Footer from "./components/nested/Footer.vue";

export default {
  name: "CubeWorldsMainPage",
  components: {
    Footer,
    ClosingConfirmation,
    ExpandedViewport,
  },
  setup() {
    const stars = ref([]);

    onMounted(() => {
      stars.value = Array.from({ length: 200 }, () => ({
        top: `${Math.random() * 100}%`,
        left: `${Math.random() * 100}%`,
        animationDuration: `${Math.random() * 3 + 1}s`,
        animationDelay: `${Math.random() * 2}s`,
      }));
    });

    return { stars };
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
</style>
