<script setup lang="ts">
import { ref } from 'vue'
import { MainButton, useWebAppHapticFeedback } from 'vue-tg'

defineProps<{ msg: string }>()

const count = ref(0)

const { notificationOccurred } = useWebAppHapticFeedback()

function increment() {
    notificationOccurred('success')
    count.value++
}
</script>

<template>
  <h1>{{ msg }}</h1>

  <div class="card">
    <button type="button" @click="increment">Count is {{ count }}</button>
    <p>
      Edit
      <code>components/HelloWorld.vue</code> to test HMR
    </p>
    <MainButton :text="`Count is ${count}`" @click="increment" />
  </div>

  <p>
    Install
    <a href="https://github.com/vuejs/language-tools" target="_blank">Volar</a>
    in your IDE for a better DX
  </p>
</template>