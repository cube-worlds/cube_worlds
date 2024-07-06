<template>
  <div class="cosmic-footer">
    <div class="footer-links">
      <router-link to="/" class="footer-link">Main</router-link>
      <!-- <router-link to="/faq" class="footer-link">FAQ</router-link> -->
      <router-link to="/clicker" class="footer-link">Clicker Game</router-link>
      <router-link to="/cnft" class="footer-link">Claim cNFT</router-link>
      <!-- <router-link to="/presentation" class="footer-link">Presentation</router-link> -->
    </div>
  </div>
</template>
<style lang="css">
.cosmic-footer {
  position: absolute;
  top: 1rem;
  right: 1rem;
  display: flex;
  align-items: center;
  color: #fff;
}

.footer-links {
  display: flex;
  margin-left: 1rem;
}

.footer-link {
  color: #fff;
  text-decoration: none;
  margin-left: 1rem;
  font-size: 0.9rem;
  transition: color 0.3s;
}

.footer-link:hover {
  color: #ff9933;
}
</style>
