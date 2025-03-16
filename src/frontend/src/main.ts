import ElementPlus from 'element-plus'
import ruLocale from 'element-plus/es/locale/lang/ru'
import { createPinia } from 'pinia'
import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import App from './App.vue'
import ClickerComponent from './components/Clicker.vue'
import CNFTComponent from './components/CNFT.vue'
import FAQComponent from './components/FAQ.vue'
import MainComponent from './components/Main.vue'
import PresentationComponent from './components/Presentation.vue'
import SatoshiComponent from './components/Satoshi.vue'
import TasksComponent from './components/Tasks.vue'
import { fluent } from './fluent'
import 'element-plus/dist/index.css'
import './style.css'

const routes = [
  // RESERVED: /cnfts /api
  { path: '/', name: 'MainPage', component: MainComponent },
  { path: '/satoshi', name: 'SatoshiPage', component: SatoshiComponent },
  { path: '/clicker', name: 'ClickerPage', component: ClickerComponent },
  { path: '/faq', name: 'FAQPage', component: FAQComponent },
  { path: '/cnft', mame: 'CNFTPage', component: CNFTComponent },
  { path: '/presentation', mame: 'PresentationPage', component: PresentationComponent },
  { path: '/tasks', mame: 'TasksPage', component: TasksComponent },
]

// if (import.meta.env.VITE_ENV === "development") {
//   routes.push({ path: "/tasks", mame: "TasksPage", component: TasksComponent });
// }

const router = createRouter({
  history: createWebHistory(),
  routes,
})

const pinia = createPinia()

createApp(App)
  .use(fluent)
  .use(pinia)
  .use(router)
  .use(ElementPlus, { size: 'default', zIndex: 3000, locale: ruLocale })
  .mount('#app')
