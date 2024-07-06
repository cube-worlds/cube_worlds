<template>
  <h1 class="main-title">Cube Worlds</h1>
  <div class="sub-title">Choose your destiny!</div>
</template>

<style scoped>
.main-title {
  font-size: 4rem;
  color: #fff;
  margin-bottom: 1rem;
  animation: pulse 2s infinite;
  text-shadow: 0 0 10px rgba(255, 255, 255, 0.5);
}

.sub-title {
  color: #fff;
  font-size: 1.5rem;
  animation: fadeIn 2.5s;
}

@keyframes pulse {
  0%,
  100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.05);
  }
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
</style>
