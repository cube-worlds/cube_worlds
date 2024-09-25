<template>
  <div class="cosmos">
    <div v-for="(star, index) in stars" :key="index" class="star" :style="star"></div>
    <div class="content-wrapper">
      <div class="top-bar">
        <div class="coin-balance">
          {{ bigIntWithCustomSeparator(userStore.balance) }}
          $CUBE
        </div>
        <div id="ton-connect"></div>
      </div>
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

<script setup lang="ts">
import { ref, onMounted, computed, provide, Ref } from "vue"
import { useWebApp, ClosingConfirmation, ExpandedViewport } from "vue-tg"
import MainMenu from "./components/nested/MainMenu.vue"
import { useAuth } from "./composables/use-auth"
import { useUserStore } from "./stores/userStore"
import { TonConnectUI } from "@tonconnect/ui"
import { enBundle, ruBundle } from "./fluent"
import { useFluent } from "fluent-vue"
import { bigIntWithCustomSeparator } from "../../bot/helpers/numbers"

const fluent = useFluent()

const tonConnectUI = ref<TonConnectUI | null>(null)
provide("tonConnectUI", tonConnectUI)

const userStore = useUserStore()

const stars: Ref<
  Array<{ top: string; left: string; animationDuration: string; animationDelay: string }>
> = ref([])
const ufoPosition = ref({ x: 0, y: 0 })

const ufoStyle = computed(() => ({
  left: `${ufoPosition.value.x}%`,
  top: `${ufoPosition.value.y}%`,
}))

function getUserIdFromRefString(refString: string): number | undefined {
  const match = refString.match(/ref_(\d+)/)
  return match && match[1] ? parseInt(match[1], 10) : undefined
}

onMounted(async () => {
  tonConnectUI.value = new TonConnectUI({
    manifestUrl: "https://cubeworlds.club/tonconnect-manifest.json",
    buttonRootId: "ton-connect",
    actionsConfiguration: {
      returnStrategy: "back",
      twaReturnUrl: "https://t.me/cube_worlds_bot/cnft?startapp=from_wallet",
    },
  })
  tonConnectUI.value.onStatusChange((wallet) => {
    console.info("Wallet updated: " + wallet)
    userStore.setWallet(wallet ?? undefined)
  })

  stars.value = Array.from({ length: 200 }, () => ({
    top: `${Math.random() * 100}%`,
    left: `${Math.random() * 100}%`,
    animationDuration: `${Math.random() * 3 + 1}s`,
    animationDelay: `${Math.random() * 2}s`,
  }))

  setInterval(() => {
    ufoPosition.value = {
      x: Math.random() * 100,
      y: Math.random() * 100,
    }
  }, 5000)

  const initData = useWebApp().initDataUnsafe
  const webAppUser = initData.user
  if (webAppUser) {
    let referId = undefined
    const start_param = initData.start_param
    if (start_param) {
      referId = getUserIdFromRefString(start_param)
      console.log("referId:", referId)
    }
    const { user, error, login } = useAuth(useWebApp().initData, webAppUser.id, referId)
    if (error.value) {
      console.log(error.value)
      return
    }
    const isLoggedIn = await login()
    if (isLoggedIn) {
      const lang = user.value.language
      fluent.bundles.value = [lang === "ru" ? ruBundle : enBundle]
      if (user.value) {
        userStore.setUser(user.value)
        console.log(user.value)
      }
    } else {
      console.error("Login error:", error.value)
    }
  }
})
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
  padding: 0.3rem;
  box-sizing: border-box;
}

.top-bar {
  position: sticky;
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  padding: 0.5rem 1rem;
  background-color: rgba(255, 255, 255, 0.1);
  border-radius: 0.5rem;
}

.coin-balance {
  font-size: 1.1rem;
  font-weight: bold;
  color: #fff;
}

.wallet-address {
  font-size: 0.9rem;
  color: #ccc;
  cursor: pointer;
  display: flex;
  align-items: center;
}

.arrow {
  border: solid #ccc;
  border-width: 0 2px 2px 0;
  display: inline-block;
  padding: 3px;
  margin-left: 0.5rem;
  transition: transform 0.3s;
}

.arrow.up {
  transform: rotate(-135deg);
}

.arrow.down {
  transform: rotate(45deg);
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
  background: radial-gradient(circle,
      rgba(255, 153, 51, 0.3) 0%,
      rgba(255, 102, 0, 0) 70%);
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
