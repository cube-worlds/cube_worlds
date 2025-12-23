import type { App, Ref } from 'vue'
import { ref } from 'vue'
import LoadingOverlay from '../components/nested/LoadingOverlay.vue'

export default {
  install(app: App) {
    const activeRequests: Ref<number> = ref(0)
    const loadingVisible: Ref<boolean> = ref(false)

    function showLoading() {
      activeRequests.value++
      loadingVisible.value = true
    }

    function hideLoading() {
      activeRequests.value--
      if (activeRequests.value <= 0) {
        activeRequests.value = 0
        loadingVisible.value = false
      }
    }

    app.provide('loadingVisible', loadingVisible)

    app.component('LoadingOverlay', LoadingOverlay)

    // ---- Override fetch ----
    const originalFetch = window.fetch
    window.fetch = async (...args) => {
      showLoading()
      try {
        return await originalFetch(...args)
      } finally {
        hideLoading()
      }
    }

    // ---- Override XHR ----
    const originalXHROpen = XMLHttpRequest.prototype.open
    XMLHttpRequest.prototype.open = function (...args: any[]) {
      this.addEventListener('loadstart', showLoading)
      this.addEventListener('loadend', hideLoading)
      return Function.prototype.apply.call(originalXHROpen, this, args)
    }
  },
}
