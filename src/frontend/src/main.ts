import ElementPlus from 'element-plus'
import ruLocale from 'element-plus/es/locale/lang/ru'
import { createPinia } from 'pinia'
import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import App from './App.vue'
import { fluent } from './fluent'
import LoadingPlugin from './plugins/loading-plugin'
import { vueRoutes } from './routes'
import 'element-plus/dist/index.css'
import './style.css'

const router = createRouter({
  history: createWebHistory(),
  routes: vueRoutes,
})

const pinia = createPinia()

createApp(App)
  .use(LoadingPlugin)
  .use(fluent)
  .use(pinia)
  .use(router)
  .use(ElementPlus, { size: 'default', zIndex: 3000, locale: ruLocale })
  .mount('#app')
