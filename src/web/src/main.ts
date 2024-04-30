import { createApp } from "vue";
import "./style.css";
import { createWebHistory, createRouter } from "vue-router";
import HelloWorld from "./components/HelloWorld.vue";
import App from "./App.vue";
import Captcha from "./components/Captcha.vue";

const routes = [
  { path: "/", component: HelloWorld },
  { path: "/captcha", component: Captcha },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

createApp(App).use(router).mount("#app");
