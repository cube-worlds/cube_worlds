<template>
  <div class="cosmos">
    <div v-for="(star, index) in stars" :key="index" class="star" :style="star"></div>

    <div class="top-bar">
      <div class="coin-balance">
        {{ displayedBalance }} $CUBE
      </div>
      <div id="ton-connect" v-show="userStore.user !== undefined"></div>
    </div>

    <div class="content-wrapper">
      <RouterView />
    </div>

    <div class="footer">
      <MainMenu />
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
    <ClosingConfirmation />
    <ExpandedViewport />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, provide, Ref } from "vue"
import { useMiniApp, ClosingConfirmation, ExpandedViewport } from "vue-tg"
import MainMenu from "./components/nested/MainMenu.vue"
import { useAuth } from "./composables/useAuth"
import { useUserStore } from "./stores/userStore"
import { ConnectedWallet, TonConnectUI } from "@tonconnect/ui"
import { enBundle, ruBundle } from "./fluent"
import { useFluent } from "fluent-vue"
import { commaSeparatedNumber } from "#root/common/helpers/numbers"

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

const displayedBalance = computed(() => {
  if (userStore.balance === null) return "???"
  return commaSeparatedNumber(userStore.balance)
})


onMounted(async () => {
  tonConnectUI.value = new TonConnectUI({
    manifestUrl: "https://cubeworlds.club/tonconnect-manifest.json",
    buttonRootId: "ton-connect",
    actionsConfiguration: {
      returnStrategy: "back",
      twaReturnUrl: "https://t.me/cube_worlds_bot/cnft?startapp=from_wallet",
    },
  })
  tonConnectUI.value.onStatusChange((wallet: ConnectedWallet | null) => {
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

  const initData = useMiniApp().initDataUnsafe
  const webAppUser = initData.user
  if (webAppUser) {
    let referId = undefined
    const start_param = initData.start_param
    if (start_param) {
      referId = getUserIdFromRefString(start_param)
      console.log("referId:", referId)
    }
    const { user, error, login } = useAuth(useMiniApp().initData, webAppUser.id, referId)
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
  flex-direction: column;
  background-color: #000033;
}

.top-bar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 1rem;
  background-color: rgba(0, 0, 51, 0.8);
  backdrop-filter: blur(5px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  height: 50px;
}

.content-wrapper {
  position: relative;
  z-index: 10;
  width: 100%;
  flex: 1;
  overflow-y: auto;
  padding: 0.5rem;
  box-sizing: border-box;
  margin-top: 50px; /* Same as top-bar height */
  margin-bottom: 60px; /* Same as footer height */
  padding-top: 1rem;
  padding-bottom: 1rem;
}

.footer {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 100;
  background-color: rgba(0, 0, 51, 0.8);
  backdrop-filter: blur(5px);
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  height: 60px;
}

.coin-balance {
  font-size: 1.1rem;
  font-weight: bold;
  color: #fff;
}

.star {
  position: fixed;
  width: 2px;
  height: 2px;
  background-color: #fff;
  border-radius: 50%;
  animation: twinkle 1s infinite alternate;
  z-index: 1;
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
  z-index: 2;
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
