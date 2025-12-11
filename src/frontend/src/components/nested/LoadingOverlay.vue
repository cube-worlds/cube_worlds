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
  height: 1.5px;
  z-index: 99999;
  pointer-events: none;
  background: transparent;
}

.loading-bar {
  height: 100%;
  background: linear-gradient(
    90deg,
    #646cff 0%,
    #7c7dff 50%,
    #646cff 100%
  );
  transition: width 0.25s ease-out;
  box-shadow: 0 0 8px rgba(100, 108, 255, 0.6);
}
</style>
