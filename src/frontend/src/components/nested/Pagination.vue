<script>
import { computed, ref } from 'vue'

export default {
    name: 'GamePagination',
    props: {
        totalPages: {
            type: Number,
            required: true,
        },
    },
    emits: ['pageChange'],
    setup(props, { emit }) {
        const currentPage = ref(1)

        const visiblePages = computed(() => {
            const pages = []
            const range = 2
            for (
                let i = Math.max(1, currentPage.value - range);
                i <= Math.min(props.totalPages, currentPage.value + range);
                i++
            ) {
                pages.push(i)
            }
            return pages
        })

        const prevPage = () => {
            if (currentPage.value > 1) {
                currentPage.value--
                emit('pageChange', currentPage.value)
            }
        }

        const nextPage = () => {
            if (currentPage.value < props.totalPages) {
                currentPage.value++
                emit('pageChange', currentPage.value)
            }
        }

        const goToPage = (page) => {
            currentPage.value = page
            emit('pageChange', currentPage.value)
        }

        return {
            currentPage,
            visiblePages,
            prevPage,
            nextPage,
            goToPage,
        }
    },
}
</script>

<template>
    <div class="game-pagination">
        <button
            :disabled="currentPage === 1"
            class="page-button"
            @click="prevPage"
        >
            Previous
        </button>
        <div class="page-numbers">
            <button
                v-for="page in visiblePages"
                :key="page"
                class="page-number"
                :class="[{ active: page === currentPage }]"
                @click="goToPage(page)"
            >
                {{ page }}
            </button>
        </div>
        <button
            :disabled="currentPage === totalPages"
            class="page-button"
            @click="nextPage"
        >
            Next
        </button>
    </div>
</template>

<style scoped>
.game-pagination {
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  background-color: rgba(0, 0, 0, 0.7);
  border-radius: 20px;
  padding: 10px;
  z-index: 1000;
}

.page-button,
.page-number {
  background-color: #444;
  color: #fff;
  border: none;
  padding: 8px 12px;
  margin: 0 5px;
  border-radius: 5px;
  cursor: pointer;
  transition: background-color 0.3s;
}

.page-button:hover,
.page-number:hover {
  background-color: #666;
}

.page-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.page-numbers {
  display: flex;
}

.page-number.active {
  background-color: #ff6600;
}
</style>
