<template>
  <!-- <el-row justify="end">
    <el-col :span="10"> <div id="ton-connect"></div></el-col>
  </el-row> -->
  <!-- <Header class="header" /> -->
  <RouterView />
  <!-- <Footer class="footer" /> -->
  <ClosingConfirmation />
  <ExpandedViewport />
</template>

<script lang="ts" setup>
import { ClosingConfirmation, ExpandedViewport } from "vue-tg";
import { ref } from "vue";

// const userStorage = useUserStore();

// onMounted(async () => {
//   console.log("onMounted");
//   const tonConnectUI = new TonConnectUI({
//     manifestUrl: "https://cubeworlds.club/tonconnect-manifest.json",
//     buttonRootId: "ton-connect",
//     // language: "ru",
//     // uiPreferences: {
//     //   theme: THEME.DARK,
//     // },
//     actionsConfiguration: {
//       returnStrategy: "back",
//       twaReturnUrl: "https://t.me/cube_worlds_bot/cnft",
//     },
//   });

// tonConnectUI.setConnectRequestParameters({ state: "loading" });
// if (userStorage.wallet) {
//   tonConnectUI.setConnectRequestParameters({
//     state: "ready",
//     value: userStorage.wallet,
//   });
// } else {
//   tonConnectUI.setConnectRequestParameters(null);
// }

// tonConnectUI.onStatusChange((wallet) => {
//   console.info("Wallet updated: " + wallet);
//   userStorage.setWallet(wallet);
//   if (
//     wallet &&
//     wallet.connectItems?.tonProof &&
//     "proof" in wallet.connectItems.tonProof
//   ) {
//     console.info("Proof: " + wallet.connectItems.tonProof.proof);
//   }
// });
// });

// const scrollableEl = ref<HTMLDivElement | null>(null);
// let ts: number | undefined;
// const onTouchStart = (e: TouchEvent) => {
//   ts = e.touches[0].clientY;
// };
// const onTouchMove = (e: TouchEvent) => {
//   if (scrollableEl && scrollableEl.value && ts) {
//     const scroll = scrollableEl.value.scrollTop;
//     const te = e.changedTouches[0].clientY;
//     if (scroll <= 0 && ts < te) {
//       e.preventDefault();
//     }
//   } else {
//     e.preventDefault();
//   }
// };
// document.documentElement.addEventListener("touchstart", onTouchStart, { passive: false });
// document.documentElement.addEventListener("touchmove", onTouchMove, { passive: false });
</script>

<style>
.el-col {
  border-radius: 4px;
}

.grid-content {
  border-radius: 4px;
  min-height: 36px;
}

.header {
  position: fixed;
  top: 0;
  width: 100%;
}

.footer {
  position: fixed;
  bottom: 0;
  width: 100%;
}
</style>
