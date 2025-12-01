<template>
  <div class="satoshi-container">
    <template v-if="!hasParticipated">
      <div class="cosmic-button-container">
        <button @click="participate" class="cosmic-button">
          <div class="button-glow"></div>
          <span class="button-text">Participate {{ initialStake }} $CUBE</span>
          <div class="button-stars">
            <div v-for="i in 5" :key="i" class="button-star"></div>
          </div>
        </button>
      </div>

      <div class="prize-info">
        <div class="info-item">
          <span class="info-label">Approximate Prize:</span>
          <span class="info-value">≈ {{ approximatePrize }} $CUBE</span>
        </div>
        <div class="info-item">
          <span class="info-label">Participants:</span>
          <span class="info-value">{{ totalParticipants }}</span>
        </div>
      </div>
    </template>

    <template v-else>
      <div class="participation-details">
        <div class="stake-display">
          <span class="stake-amount">{{ currentStake }}</span>
          <span class="cube-symbol">$CUBE</span>
          <span class="multiplier">{{ currentMultiplier }}×</span>
        </div>

        <div class="prize-info active">
          <div class="info-item">
            <span class="info-label">Approximate Prize:</span>
            <span class="info-value">≈ {{ approximatePrize }} $CUBE</span>
          </div>
          <div class="info-item">
            <span class="info-label">Participants:</span>
            <span class="info-value">{{ totalParticipants }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Your Share:</span>
            <span class="info-value">{{ calculateShare }}%</span>
          </div>
        </div>

        <div class="action-buttons">
          <button
            @click="increaseStake"
            class="action-button increase-stake"
            :disabled="currentStake >= maxStake"
          >
            <span class="button-icon">+</span>
            <span class="button-label">Increase Stake</span>
          </button>

          <button
            @click="increaseMultiplier"
            class="action-button increase-multiplier"
            :disabled="currentMultiplier >= maxMultiplier"
          >
            <span class="button-icon">×</span>
            <span class="button-label">Increase Multiplier</span>
          </button>
        </div>
      </div>
    </template>

    <div class="satoshi-footer">
      <a href="https://chiliec.github.io/Satoshi/" target="_blank" class="mining-link">
        <div class="mining-icon">
          <div class="pickaxe"></div>
          <div class="sparkles">
            <div class="sparkle"></div>
            <div class="sparkle"></div>
            <div class="sparkle"></div>
          </div>
        </div>
        <span>Direct Mining</span>
      </a>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import axios from 'axios';

const initialStake = 100;
const maxStake = 500;
const maxMultiplier = 5;

const hasParticipated = ref(false);
const currentStake = ref(initialStake);
const currentMultiplier = ref(1);
const totalParticipants = ref(143);
const approximatePrize = ref(15600);
const totalPoolStake = ref(76400);

const calculateShare = computed(() => {
  const userEffectiveStake = currentStake.value * currentMultiplier.value;
  const sharePercentage = (userEffectiveStake / totalPoolStake.value) * 100;
  return sharePercentage.toFixed(2);
});

async function participate() {
  try {
    const response = await axios.post('/api/satoshi/participate', {
      stake: initialStake,
      multiplier: currentMultiplier.value
    });

    if (response.status === 200) {
      hasParticipated.value = true;
      totalParticipants.value++;
      totalPoolStake.value += initialStake;
      // In a real implementation, you would update these values from the response
    }
  } catch (error) {
    console.error('Failed to participate:', error);
  }
}

async function increaseStake() {
  if (currentStake.value < maxStake) {
    try {
      const stakeToAdd = 100;
      const response = await axios.post('/api/satoshi/participate', {
        stake: stakeToAdd,
        multiplier: currentMultiplier.value
      });

      if (response.status === 200) {
        const previousStake = currentStake.value;
        currentStake.value = Math.min(currentStake.value + stakeToAdd, maxStake);
        totalPoolStake.value += (currentStake.value - previousStake);
        // Update approximate prize and other stats based on response
      }
    } catch (error) {
      console.error('Failed to increase stake:', error);
    }
  }
}

function increaseMultiplier() {
  if (currentMultiplier.value < maxMultiplier) {
    // Show ad and then increase multiplier
    // This would be replaced with your ad showing logic
    setTimeout(() => {
      currentMultiplier.value++;
    }, 1000);
  }
}
</script>

<style scoped>
.satoshi-container {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  color: white;
  min-height: 70vh;
  position: relative;
}

.cosmic-button-container {
  position: relative;
  margin: 2rem 0;
}

.cosmic-button {
  position: relative;
  background: linear-gradient(135deg, #4a00e0, #8e2de2);
  border: none;
  border-radius: 2rem;
  padding: 1rem 2rem;
  color: white;
  font-size: 1.2rem;
  font-weight: bold;
  cursor: pointer;
  overflow: hidden;
  transition: all 0.3s ease;
  box-shadow: 0 0 15px rgba(142, 45, 226, 0.6);
}

.cosmic-button:hover {
  transform: translateY(-5px);
  box-shadow: 0 0 25px rgba(142, 45, 226, 0.8);
}

.button-glow {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: radial-gradient(circle, rgba(255, 255, 255, 0.8) 0%, rgba(255, 255, 255, 0) 70%);
  opacity: 0;
  transition: opacity 0.3s;
}

.cosmic-button:hover .button-glow {
  opacity: 0.3;
  animation: glow-pulse 2s infinite;
}

.button-text {
  position: relative;
  z-index: 2;
}

.button-stars {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

.button-star {
  position: absolute;
  width: 2px;
  height: 2px;
  background-color: white;
  border-radius: 50%;
  opacity: 0;
}

.cosmic-button:hover .button-star:nth-child(1) {
  top: 20%;
  left: 10%;
  animation: twinkle 1.5s infinite alternate;
  animation-delay: 0.1s;
}

.cosmic-button:hover .button-star:nth-child(2) {
  top: 30%;
  left: 80%;
  animation: twinkle 1.3s infinite alternate;
  animation-delay: 0.3s;
}

.cosmic-button:hover .button-star:nth-child(3) {
  top: 70%;
  left: 20%;
  animation: twinkle 1.7s infinite alternate;
  animation-delay: 0.5s;
}

.cosmic-button:hover .button-star:nth-child(4) {
  top: 60%;
  left: 70%;
  animation: twinkle 1.2s infinite alternate;
  animation-delay: 0.2s;
}

.cosmic-button:hover .button-star:nth-child(5) {
  top: 40%;
  left: 50%;
  animation: twinkle 1.4s infinite alternate;
  animation-delay: 0.4s;
}

.participation-details {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
}

.stake-display {
  position: relative;
  font-size: 3rem;
  font-weight: bold;
  margin-bottom: 2rem;
  text-align: center;
  text-shadow: 0 0 10px rgba(255, 255, 255, 0.5);
  animation: float 4s ease-in-out infinite;
}

.stake-amount {
  font-size: 3.5rem;
  background: linear-gradient(to right, #f9d423, #ff4e50);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

.cube-symbol {
  margin-left: 0.5rem;
  font-size: 2rem;
  color: #a0a0ff;
}

.multiplier {
  position: absolute;
  top: 0;
  right: -1.5rem;
  font-size: 1.5rem;
  color: #ff9966;
  animation: pulse 2s infinite;
}

.action-buttons {
  display: flex;
  justify-content: center;
  gap: 1rem;
  width: 100%;
  max-width: 600px;
  margin-top: 2rem;
}

.action-button {
  flex: 1;
  position: relative;
  padding: 1rem;
  border: none;
  border-radius: 1rem;
  color: white;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.action-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.increase-stake {
  background: linear-gradient(135deg, #43cea2, #185a9d);
  box-shadow: 0 0 10px rgba(67, 206, 162, 0.5);
}

.increase-multiplier {
  background: linear-gradient(135deg, #ff9966, #ff5e62);
  box-shadow: 0 0 10px rgba(255, 153, 102, 0.5);
}

.action-button:not(:disabled):hover {
  transform: translateY(-3px);
  box-shadow: 0 0 20px rgba(255, 255, 255, 0.4);
}

.button-icon {
  font-size: 1.5rem;
  margin-bottom: 0.5rem;
}

.button-label {
  font-size: 0.9rem;
}

.prize-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  margin: 1rem 0;
  padding: 1rem;
  border-radius: 1rem;
  background-color: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(4px);
  width: 100%;
  max-width: 400px;
}

.prize-info.active {
  background-color: rgba(255, 255, 255, 0.15);
  animation: subtle-glow 3s infinite alternate;
}

.info-item {
  display: flex;
  justify-content: space-between;
  width: 100%;
  padding: 0.3rem 0;
}

.info-label {
  color: #a0a0ff;
  font-size: 0.9rem;
}

.info-value {
  font-weight: bold;
  font-size: 0.9rem;
  color: #ffffff;
}

.satoshi-footer {
  position: absolute;
  bottom: 1rem;
  left: 0;
  right: 0;
  display: flex;
  justify-content: center;
  padding: 1rem;
}

.mining-link {
  display: flex;
  align-items: center;
  color: #a0a0ff;
  text-decoration: none;
  font-size: 0.9rem;
  padding: 0.5rem 1rem;
  border-radius: 2rem;
  background-color: rgba(255, 255, 255, 0.1);
  transition: all 0.3s ease;
}

.mining-link:hover {
  background-color: rgba(255, 255, 255, 0.2);
  transform: translateY(-2px);
  box-shadow: 0 0 15px rgba(160, 160, 255, 0.4);
}

.mining-icon {
  position: relative;
  width: 20px;
  height: 20px;
  margin-right: 0.5rem;
}

.pickaxe {
  position: absolute;
  width: 10px;
  height: 2px;
  background-color: #a0a0ff;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%) rotate(-45deg);
}

.pickaxe:before {
  content: '';
  position: absolute;
  width: 6px;
  height: 2px;
  background-color: #a0a0ff;
  top: -2px;
  right: -1px;
  transform: rotate(-60deg);
}

.sparkles {
  position: absolute;
  width: 100%;
  height: 100%;
}

.sparkle {
  position: absolute;
  width: 2px;
  height: 2px;
  background-color: #ffffff;
  border-radius: 50%;
}

.sparkle:nth-child(1) {
  top: 30%;
  left: 70%;
  animation: sparkle 1.5s infinite;
}

.sparkle:nth-child(2) {
  top: 60%;
  left: 80%;
  animation: sparkle 1.7s infinite;
  animation-delay: 0.5s;
}

.sparkle:nth-child(3) {
  top: 50%;
  left: 90%;
  animation: sparkle 1.3s infinite;
  animation-delay: 0.3s;
}

@keyframes glow-pulse {
  0%, 100% { opacity: 0.2; }
  50% { opacity: 0.5; }
}

@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
}

@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.1); }
}

@keyframes twinkle {
  0% { opacity: 0; transform: scale(1); }
  100% { opacity: 1; transform: scale(1.5); }
}

@keyframes sparkle {
  0% { opacity: 0; transform: scale(1); }
  50% { opacity: 1; transform: scale(1.5); }
  100% { opacity: 0; transform: scale(1); }
}

@keyframes subtle-glow {
  0% { box-shadow: 0 0 5px rgba(160, 160, 255, 0.2); }
  100% { box-shadow: 0 0 15px rgba(160, 160, 255, 0.5); }
}
</style>
