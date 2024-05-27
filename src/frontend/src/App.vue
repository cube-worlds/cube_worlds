<template>
  <button id="ton-connection" />
  <!-- <Header class="header" /> -->
  <RouterView />
  Wallets: {{ walletsList }}
  <!-- <Footer class="footer" /> -->
  <ClosingConfirmation />
  <ExpandedViewport />
</template>

<script lang="ts" setup>
import { ClosingConfirmation, ExpandedViewport } from "vue-tg";
import { ref } from "vue";
import { TonConnectUI, THEME } from "@tonconnect/ui";

const tonConnectUI = new TonConnectUI({
  manifestUrl: "https://cubeworlds.club/tonconnect-manifest.json",
  buttonRootId: "ton-connection",
});
tonConnectUI.uiOptions = {
  language: "ru",
  uiPreferences: {
    theme: THEME.DARK,
  },
};
const walletsList = await tonConnectUI.getWallets();

const scrollableEl = ref<HTMLDivElement | null>(null);
let ts: number | undefined;
const onTouchStart = (e: TouchEvent) => {
  ts = e.touches[0].clientY;
};
const onTouchMove = (e: TouchEvent) => {
  if (scrollableEl && scrollableEl.value && ts) {
    const scroll = scrollableEl.value.scrollTop;
    const te = e.changedTouches[0].clientY;
    if (scroll <= 0 && ts < te) {
      e.preventDefault();
    }
  } else {
    e.preventDefault();
  }
};
document.documentElement.addEventListener("touchstart", onTouchStart, { passive: false });
document.documentElement.addEventListener("touchmove", onTouchMove, { passive: false });
</script>

<style>
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
