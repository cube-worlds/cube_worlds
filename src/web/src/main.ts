import { createApp } from "vue";
import { createWebHistory, createRouter } from "vue-router";
import ElementPlus from "element-plus";
import "element-plus/dist/index.css";
import ruLocale from "element-plus/es/locale/lang/ru";
import HelloWorld from "./components/HelloWorld.vue";
import FAQComponent from "./components/FAQ.vue";
import App from "./App.vue";

const routes = [
  { path: "/", name: "MainPage", component: HelloWorld },
  { path: "/faq", name: "FAQPage", component: FAQComponent },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

createApp(App)
  .use(router)
  .use(ElementPlus, { size: "default", zIndex: 3000, locale: ruLocale })
  .mount("#app");
