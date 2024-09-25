import { createApp } from "vue";
import { createPinia } from "pinia";
import { createWebHistory, createRouter } from "vue-router";
import ElementPlus from "element-plus";
import "element-plus/dist/index.css";
import ruLocale from "element-plus/es/locale/lang/ru";
import MainComponent from "./components/Main.vue";
import "./style.css";
import App from "./App.vue";
import CNFTComponent from "./components/CNFT.vue";
import FAQComponent from "./components/FAQ.vue";
import PresentationComponent from "./components/Presentation.vue";
import { fluent } from "./fluent";
import ClickerComponent from "./components/Clicker.vue";
import TasksComponent from "./components/Tasks.vue";

const routes = [
  // RESERVED: /cnfts /api
  { path: "/", name: "MainPage", component: MainComponent },
  { path: "/clicker", name: "ClickerPage", component: ClickerComponent },
  { path: "/faq", name: "FAQPage", component: FAQComponent },
  { path: "/cnft", mame: "CNFTPage", component: CNFTComponent },
  { path: "/presentation", mame: "PresentationPage", component: PresentationComponent },
  { path: "/tasks", mame: "TasksPage", component: TasksComponent }
];

// if (import.meta.env.VITE_ENV === "development") {
//   routes.push({ path: "/tasks", mame: "TasksPage", component: TasksComponent });
// }

const router = createRouter({
  history: createWebHistory(),
  routes,
});

const pinia = createPinia();

createApp(App)
  .use(fluent)
  .use(pinia)
  .use(router)
  .use(ElementPlus, { size: "default", zIndex: 3000, locale: ruLocale })
  .mount("#app");
