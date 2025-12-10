<template>
  <div class="cosmic-menu">
    <div class="menu-links">
      <router-link
        v-for="item in menu"
        :key="item.path"
        :to="item.path"
        class="menu-link"
        active-class="active"
      >
        {{ item.emoji }}
      </router-link>
    </div>
  </div>
</template>

<script setup lang="ts">
import { menuRoutes } from '@/routes'

const menu = menuRoutes.filter(r => r.showInMenu)
</script>

<style lang="css" scoped>
.cosmic-menu {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 0.5rem;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(10px);
  z-index: 100;
}

.menu-links {
  display: flex;
  justify-content: space-between;
  width: 100%;
  max-width: 500px;
}

.menu-link {
  flex: 1;
  text-align: center;
  color: #fff;
  text-decoration: none;
  font-size: 1.8rem;
  transition: all 0.3s ease;
  position: relative;
  padding: 0.5rem 0;
}

.menu-link::after {
  content: "";
  position: absolute;
  bottom: 0;
  left: 20%;
  width: 60%;
  height: 2px;
  background: #ff9933;
  transform: scaleX(0);
  transition: transform 0.3s ease;
}

.menu-link:hover {
  transform: scale(1.3) rotate(15deg);
}

.menu-link.active {
  transform: scale(1);
  color: #ff9933;
}

.menu-link.active::after {
  transform: scaleX(1);
}

@media (max-width: 400px) {
  .menu-link {
    font-size: 1.5rem;
  }
}
</style>
