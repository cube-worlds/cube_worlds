<script setup lang="ts">
import type { Ref } from 'vue'
import { inject } from 'vue'

const visible = inject('loadingVisible') as Ref<boolean>
</script>

<template>
  <div v-show="visible" class="loading-container">
    <div class="loading-bar" />
  </div>
</template>

<style scoped>
.loading-container {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 1.5px;
  z-index: 99999;
  pointer-events: none;
  background: transparent;
}

.loading-bar {
  height: 100%;
  background: linear-gradient(
    90deg,
    transparent 0%,
    #646cff 20%,
    #646cff 80%,
    transparent 100%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s ease-in-out infinite;
  transition: width 0.25s ease-out;
  box-shadow: 0 0 8px rgba(100, 108, 255, 0.5);
}

@keyframes shimmer {
  0% {
    background-position: 200% 0;
  }
  50% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
}
</style>
