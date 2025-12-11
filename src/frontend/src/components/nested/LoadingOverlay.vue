<script setup lang="ts">
import type { Ref } from 'vue'
import { inject } from 'vue'

const visible = inject('loadingVisible') as Ref<boolean>
const progress = inject('loadingProgress') as Ref<number>
</script>

<template>
    <div
        v-show="visible"
        class="loading-container"
    >
        <div
            class="loading-bar"
            :style="{ width: `${progress}%` }"
        />
    </div>
</template>

<style scoped>
.loading-container {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 3px;
  z-index: 99999;
  pointer-events: none;
  background: transparent;
}

.loading-bar {
  height: 100%;
  background-color: var(--tg-theme-button-text-color, #646cff);
  transition: width 0.2s ease;
  border-radius: 2px;
}
</style>
