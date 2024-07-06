<template>
  <div class="cosmos">
    <div v-for="(star, index) in stars" :key="index" class="star" :style="star"></div>

    <div class="content-wrapper">
      <h1 class="game-title">Cube Worlds</h1>
      <div class="welcome-message">Choose your destiny!</div>
    </div>

    <div class="solar-system">
      <div class="sun">
        <div class="sun-core"></div>
        <div class="sun-rays"></div>
      </div>
    </div>

    <div class="cosmic-footer">
      <div class="footer-links">
        <router-link to="/faq" class="footer-link">FAQ</router-link>
        <router-link to="/clicker" class="footer-link">Clicker Game</router-link>
        <router-link to="/cnft" class="footer-link">Claim cNFT</router-link>
        <router-link to="/presentation" class="footer-link">Presentation</router-link>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted } from "vue";

export default {
  name: "CubeWorldsMainPage",
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
  background: radial-gradient(ellipse at bottom, #1b2735 0%, #090a0f 100%);
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
}

.star {
  position: absolute;
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

.content-wrapper {
  text-align: center;
  z-index: 10;
}

.game-title {
  font-size: 4rem;
  color: #fff;
  margin-bottom: 1rem;
  animation: pulse 2s infinite;
  text-shadow: 0 0 10px rgba(255, 255, 255, 0.5);
}

.welcome-message {
  color: #fff;
  font-size: 1.5rem;
  animation: fadeIn 0.5s;
}

.solar-system {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 15%;
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

.cosmic-footer {
  position: absolute;
  top: 1rem;
  right: 1rem;
  display: flex;
  align-items: center;
  color: #fff;
}

.footer-links {
  display: flex;
  margin-left: 1rem;
}

.footer-link {
  color: #fff;
  text-decoration: none;
  margin-left: 1rem;
  font-size: 0.9rem;
  transition: color 0.3s;
}

.footer-link:hover {
  color: #ff9933;
}

@keyframes orbit {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
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

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
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

@keyframes rotate {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}
</style>
