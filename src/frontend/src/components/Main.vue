<template>
  <div class="cosmos">
    <div v-for="(star, index) in stars" :key="index" class="star" :style="star"></div>

    <div class="content-wrapper">
      <h1 class="game-title">Cube Worlds</h1>
      <div v-if="selectedPlanet" class="welcome-message">
        Welcome to {{ selectedPlanet }}!
      </div>
    </div>

    <div class="solar-system">
      <div class="sun">
        <div class="sun-core"></div>
        <div class="sun-rays"></div>
      </div>
      <Planet
        v-for="planet in planets"
        :key="planet.name"
        v-bind="planet"
        @click="selectPlanet(planet.name)"
      />
    </div>

    <div class="cosmic-footer">
      <div class="footer-links">
        <!-- <router-link to="/faq" class="footer-link">FAQ</router-link> -->
        <router-link to="/cnft" class="footer-link">Claim cNFT</router-link>
        <router-link to="/clicker" class="footer-link">Clicker Game</router-link>
        <!-- <router-link to="/presentation" class="footer-link">Presentation</router-link> -->
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, defineComponent } from "vue";

const Planet = defineComponent({
  props: ["name", "color", "size", "angle", "distance", "ringColor"],
  template: `
        <div class="orbit" :style="orbitStyle">
          <div class="planet" :style="planetStyle" @click="$emit('click')">
            <div class="planet-surface" :style="surfaceStyle"></div>
            <div v-if="ringColor" class="planet-ring" :style="ringStyle"></div>
            <span class="planet-name">{{ name }}</span>
          </div>
        </div>
      `,
  computed: {
    orbitStyle() {
      return {
        width: `${this.distance * 2}px`,
        height: `${this.distance * 2}px`,
        animation: `orbit ${30 + this.distance / 10}s linear infinite`,
      };
    },
    planetStyle() {
      return {
        width: `${this.size}px`,
        height: `${this.size}px`,
        transform: `rotate(${this.angle}deg) translate(${this.distance}px) rotate(-${this.angle}deg)`,
      };
    },
    surfaceStyle() {
      return {
        backgroundColor: this.color,
        boxShadow: `inset ${this.size / 5}px ${-this.size / 10}px ${
          this.size / 3
        }px rgba(0,0,0,0.5)`,
      };
    },
    ringStyle() {
      return {
        borderColor: this.ringColor,
        width: `${this.size * 1.4}px`,
        height: `${this.size * 0.3}px`,
        marginTop: `${this.size * 0.35}px`,
      };
    },
  },
});

export default {
  name: "CubeWorldsMainPage",
  components: { Planet },
  setup() {
    const selectedPlanet = ref(null);
    const stars = ref([]);

    const planets = [
      { name: "FAQ", color: "#FFB3BA", size: 40, angle: 0, distance: 150 },
      { name: "Stardust", color: "#BAFFC9", size: 50, angle: 60, distance: 220 },
      {
        name: "Asteroids",
        color: "#BAE1FF",
        size: 45,
        angle: 120,
        distance: 290,
        ringColor: "#C8A2C8",
      },
      { name: "Clicker", color: "#FFFFBA", size: 55, angle: 180, distance: 370 },
      {
        name: "Explorers",
        color: "#FFD9BA",
        size: 60,
        angle: 240,
        distance: 450,
        ringColor: "#FFB347",
      },
      { name: "Tales", color: "#E8BAFF", size: 50, angle: 300, distance: 520 },
    ];

    const selectPlanet = (name) => {
      selectedPlanet.value = name;
    };

    onMounted(() => {
      stars.value = Array.from({ length: 200 }, () => ({
        top: `${Math.random() * 100}%`,
        left: `${Math.random() * 100}%`,
        animationDuration: `${Math.random() * 3 + 1}s`,
        animationDelay: `${Math.random() * 2}s`,
      }));
    });

    return { selectedPlanet, stars, planets, selectPlanet };
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

.orbit {
  position: absolute;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 50%;
}

.planet {
  position: absolute;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: transform 0.3s;
}

.planet:hover {
  transform: scale(1.1);
}

.planet-surface {
  width: 100%;
  height: 100%;
  border-radius: 50%;
}

.planet-ring {
  position: absolute;
  border-style: solid;
  border-width: 4px 0 0 0;
  border-radius: 50%;
}

.planet-name {
  position: absolute;
  color: #fff;
  font-size: 0.8rem;
  font-weight: bold;
  text-shadow: 0 0 5px rgba(0, 0, 0, 0.5);
}

.cosmic-footer {
  position: absolute;
  bottom: 1rem;
  right: 1rem;
  display: flex;
  align-items: center;
  color: #fff;
}

.star-icon {
  margin-left: 0.5rem;
  animation: spin 10s linear infinite;
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
