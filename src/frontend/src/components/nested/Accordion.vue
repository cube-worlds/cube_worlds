<!-- eslint-disable vue/no-mutating-props -->
<script>
export default {
    name: 'AccordionComponent',
    props: {
        items: {
            type: Array,
            required: true,
        },
    },
    methods: {
        toggle(index) {
            this.items[index].open = !this.items[index].open
        },
    },
}
</script>

<template>
    <div class="w-full">
        <div
            v-for="(item, index) in items"
            :key="index"
            class="mb-2"
        >
            <div
                class="p-4 cursor-pointer text-white font-psychic-force hover:bg-opacity-10 hover:bg-white transition-colors"
                @click="toggle(index)"
            >
                <h2>{{ item.question }}</h2>
            </div>
            <div
                v-show="item.open"
                class="p-4 text-gray-300"
            >
                <p>{{ item.answer }}</p>
            </div>
        </div>
    </div>
</template>

<style scoped>
/* No empty rulesets - using Tailwind classes instead */
</style>
