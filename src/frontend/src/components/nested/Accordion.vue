<template>
  <div class="accordion">
    <div v-for="(item, index) in items" :key="index" class="accordion-item">
      <div class="accordion-header" @click="toggle(index)">
        <h2>{{ item.question }}</h2>
      </div>
      <div v-show="item.open" class="accordion-content">
        <p>{{ item.answer }}</p>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: "Accordion",
  props: {
    items: {
      type: Array,
      required: true,
    },
  },
  methods: {
    toggle(index) {
      this.items[index].open = !this.items[index].open;
    },
  },
};
</script>

<style scoped>
.accordion {
}

.accordion-item {
}

.accordion-header {
  padding: 1rem;
  cursor: pointer;
  /* background-color: #333; */
  color: #fff;
  font-family: Psychic-Force, sans-serif;
}

.accordion-header:hover {
  /* background-color: #444; */
}

.accordion-content {
  padding: 1rem;
  /* background-color: #222; */
  color: #ddd;
}
</style>
