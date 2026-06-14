import ElementPlus from 'element-plus'
import ruLocale from 'element-plus/es/locale/lang/ru'
import { createPinia } from 'pinia'
import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import App from './App.vue'
import { fluent } from './fluent'
import LoadingPlugin from './plugins/loading-plugin'
import { vueRoutes } from './routes'
import { useUserStore } from './stores/userStore'
import 'element-plus/dist/index.css'
import './style.css'

const router = createRouter({
  history: createWebHistory(),
  routes: vueRoutes,
})

const pinia = createPinia()
// Pinia must be active before the guard reads the store on the first navigation.
const userStore = useUserStore(pinia)

// NFT-gated entry: until the user owns an NFT (minted), lock every route to the
// mint page; once minted, keep them out of the gate. Pre-login (user undefined)
// we allow navigation — App.vue shows the loading overlay until login resolves.
router.beforeEach((to) => {
  const user = userStore.user
  if (!user) return true
  if (!user.minted && to.path !== '/mint') return '/mint'
  if (user.minted && to.path === '/mint') return '/'
  return true
})

createApp(App)
  .use(LoadingPlugin)
  .use(fluent)
  .use(pinia)
  .use(router)
  .use(ElementPlus, { size: 'default', zIndex: 3000, locale: ruLocale })
  .mount('#app')
