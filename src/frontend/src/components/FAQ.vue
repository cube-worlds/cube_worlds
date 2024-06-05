<template>
  <div id="app">
    <Accordion :items="faqItems" />
  </div>
</template>

<script>
import Accordion from "./Accordion.vue";
import faq from "../assets/ru/faq.json";

export default {
  name: "FAQ",
  components: {
    Accordion,
  },
  data() {
    return {
      faqItems: faq,
    };
  },
};
</script>
