<script setup lang="ts">
import faq from '../assets/ru/faq.json'
import Accordion from './nested/Accordion.vue'

const faqItems = faq
</script>

<template>
  <div id="app">
    <Accordion :items="faqItems" />
  </div>
</template>
