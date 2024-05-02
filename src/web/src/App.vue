<template>
  <main>
    <Header class="header" />
    <div class="flex main-container">
      <RouterView />
    </div>
    <Footer class="footer" />
  </main>
</template>

<style>
.header {
  position: fixed;
  top: 0;
  width: 100%;
}

.footer {
  position: fixed;
  bottom: 0;
  width: 100%;
}

#app {
  text-align: center;
  color: var(--tg-theme-text-color);
  height: 100%;
  width: 100%;
  margin: 0;
  padding: 0;
}

.main-container {
  height: calc(100vh - var(--ep-menu-item-height) - 3px);
}

:root {
  font-family: Inter, system-ui, Avenir, Helvetica, Arial, sans-serif;
  line-height: 1.5;
  font-weight: 400;

  color-scheme: light dark;
  color: rgba(255, 255, 255, 0.87);

  font-synthesis: none;
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  -webkit-text-size-adjust: 100%;
}

a {
  font-weight: 500;
  color: var(--tg-theme-link-color);
  text-decoration: inherit;
}

a:hover {
  color: var(--tg-theme-link-color);
}

body {
  margin: 0;
  display: flex;
  place-items: center;
  min-width: 320px;
  min-height: 100vh;
  background-color: var(--tg-theme-bg-color);
}
</style>
