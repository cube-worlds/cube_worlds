<template>
  <div class="cosmic-footer">
    <div class="footer-links">
      <router-link to="/" class="footer-link">🏠</router-link>
      <!-- <router-link to="/nft" class="footer-link">🖼️</router-link> -->
      <!-- <router-link to="/game" class="footer-link">🎮</router-link> -->
      <!-- <router-link to="/faq" class="footer-link">📖</router-link> -->
      <!-- <router-link to="/presentation" class="footer-link">🎙️</router-link> -->
      <!-- <router-link to="/leaderboard" class="footer-link">🏆</router-link> -->
      <!-- <router-link to="/balance" class="footer-link">💰</router-link> -->
      <router-link to="/cnft" class="footer-link">🎨</router-link>
      <router-link to="/clicker" class="footer-link">🖱️</router-link>
    </div>
  </div>
</template>

<style lang="css" scoped>
.cosmic-footer {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 1rem;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(10px);
  z-index: 100;
}

.footer-links {
  display: flex;
  justify-content: center;
  gap: 2rem;
}

.footer-link {
  color: #fff;
  text-decoration: none;
  font-size: 2rem;
  transition: all 0.3s ease;
  position: relative;
  padding: 0.5rem 1rem;
}

.footer-link::after {
  content: "";
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 2px;
  background: #ff9933;
  transform: scaleX(0);
  transition: transform 0.3s ease;
}

.footer-link:hover {
  transform: scale(1.2) rotate(15deg);
}

.footer-link:hover::after {
  transform: scaleX(1);
}
</style>
