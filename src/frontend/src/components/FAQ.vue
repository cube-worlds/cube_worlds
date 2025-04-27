<template>
  <div id="app">
    <Accordion :items="faqItems" />
  </div>
</template>

<script setup lang="ts">
import Accordion from "./nested/Accordion.vue";
import faq from "../assets/ru/faq.json";

const faqItems = faq;
</script>
