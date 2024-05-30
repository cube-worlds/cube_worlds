import { createApp } from "vue";
import { createWebHistory, createRouter } from "vue-router";
import ElementPlus from "element-plus";
import "element-plus/dist/index.css";
import ruLocale from "element-plus/es/locale/lang/ru";
import MainComponent from "./components/Main.vue";
import FAQComponent from "./components/FAQ.vue";
import "./style.css";
import App from "./App.vue";
import FreeComponent from "./components/MiniApp/Free.vue";

const routes = [
  { path: "/", name: "MainPage", component: MainComponent },
  { path: "/faq", name: "FAQPage", component: FAQComponent },
  { path: "/miniapp/free_cnft", mame: "FreePage", component: FreeComponent },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

createApp(App)
  .use(router)
  .use(ElementPlus, { size: "default", zIndex: 3000, locale: ruLocale })
  .mount("#app");
