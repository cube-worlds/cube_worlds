<template>
  <div id="presentation" @keyup.passive.="nextSlide">
    <div class="slide active">
      <h1>Cube Worlds</h1>
      <div class="cube-word">CUBE WORLDS</div>
      <p>
        An innovative text-based RPG game integrated with Telegram bot and TON blockchain
      </p>
      <p>Embark on a pixelated adventure where your choices shape the world!</p>
    </div>

    <div class="slide">
      <h2>Game Overview</h2>
      <div class="cube-word">CUBE WORLDS</div>
      <ul>
        <li>Open-world experience with impactful player decisions</li>
        <li>Interact via @cube_worlds_bot on Telegram</li>
        <li>Dynamic NPC and player interactions</li>
        <li>Blockchain integration for true ownership</li>
      </ul>
    </div>

    <div class="slide">
      <h2>Impressive Traction</h2>
      <p>With <span class="highlight">zero marketing budget</span>, we've achieved:</p>
      <ul>
        <li><span class="highlight">5,346+</span> user wallets</li>
        <li><span class="highlight">20,000+</span> Telegram bot interactions</li>
        <li><span class="highlight">556</span> unique NFTs minted</li>
        <li><span class="highlight">716</span> cNFT collection claims</li>
      </ul>
      <p>Join the growing Cube Worlds community!</p>
    </div>

    <div class="slide">
      <h2>NFT Collections</h2>
      <div class="qr-container">
        <div class="qr-code">
          <img src="" alt="Game NFTs QR Code" />
          <p>Game NFTs</p>
        </div>
        <div class="qr-code">
          <img src="" alt="Gift cNFT Collection QR Code" />
          <p>Gift cNFT Collection</p>
        </div>
      </div>
      <p>Scan to explore our unique NFT collections on GetGems!</p>
    </div>

    <div class="slide">
      <h2>$CUBE Token Economy</h2>
      <div class="cube-word">TOKEN</div>
      <ul>
        <li>Acquire $CUBE through bot interaction and smart contract</li>
        <li>Halving distribution schedule every 3 months</li>
        <li>50% of TON for operations, 50% for token support</li>
      </ul>
    </div>

    <div class="slide">
      <h2>$CUBE Token Distribution</h2>
      <table class="token-table">
        <thead>
          <tr>
            <th>Time Period</th>
            <th>$CUBE per TON</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Initial</td>
            <td>50,000</td>
          </tr>
          <tr>
            <td>After 3 months</td>
            <td>25,000</td>
          </tr>
          <tr>
            <td>After 6 months</td>
            <td>12,500</td>
          </tr>
          <tr>
            <td>After 9 months</td>
            <td>6,250</td>
          </tr>
          <tr>
            <td>After 12 months</td>
            <td>3,125</td>
          </tr>
        </tbody>
      </table>
      <p>Distribution halves every 3 months</p>
    </div>

    <div class="slide">
      <h2>Gameplay Mechanics</h2>
      <div class="cube-word">GAME</div>
      <ul>
        <li>Mint unique character NFTs</li>
        <li>AI-generated narrative options</li>
        <li>Time-based turns with $CUBE speed-up option</li>
        <li>Earn $CUBE and in-game items as rewards</li>
        <li>Trade NFT items in the open market</li>
      </ul>
      <p>Every decision shapes your Cube Worlds adventure!</p>
    </div>

    <div class="slide">
      <h2>NPC Creation Ecosystem</h2>
      <ul>
        <li>Create and submit your own NPCs</li>
        <li>Approved NPCs minted as NFTs and auctioned</li>
        <li>NPC creators receive 30% of final sale price</li>
        <li>NPC owners earn % of $CUBE from interactions</li>
      </ul>
      <p>Contribute to the world and earn rewards!</p>
    </div>

    <div class="slide">
      <h2>Conclusions</h2>
      <p>Experience the future of gaming:</p>
      <ul>
        <li>Text-based RPG meets blockchain innovation</li>
        <li>Player-driven economy and world-building</li>
        <li>Unique NFT ownership and creation</li>
        <li>Engage with a growing community of players and creators</li>
      </ul>
      <p>Start your adventure now with @cube_worlds_bot on Telegram!</p>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from "vue";
const currentSlide = ref(0);
const slides = ref([]);

const showSlide = (n) => {
  slides.value[currentSlide.value].classList.remove("active");
  currentSlide.value = (n + slides.value.length) % slides.value.length;
  slides.value[currentSlide.value].classList.add("active");
};

const nextSlide = () => {
  showSlide(currentSlide.value + 1);
};

const prevSlide = () => {
  showSlide(currentSlide.value - 1);
};

const handleKeydown = (event) => {
  if (event.key === "ArrowRight") {
    nextSlide();
  } else if (event.key === "ArrowLeft") {
    prevSlide();
  }
};

let touchStartX = 0;
let touchEndX = 0;

function handleTouchStart(event) {
  touchStartX = event.changedTouches[0].screenX;
}

function handleTouchEnd(event) {
  touchEndX = event.changedTouches[0].screenX;
  handleSwipe();
}

function handleSwipe() {
  if (touchStartX - touchEndX > 50) {
    nextSlide();
  }
  if (touchEndX - touchStartX > 50) {
    prevSlide();
  }
}

onMounted(() => {
  slides.value = document.querySelectorAll(".slide");
  document.addEventListener("keydown", handleKeydown);

  document.addEventListener("touchstart", handleTouchStart, false);
  document.addEventListener("touchend", handleTouchEnd, false);
});

onUnmounted(() => {
  document.removeEventListener("keydown", handleKeydown);
  document.removeEventListener("touchstart", handleTouchStart);
  document.removeEventListener("touchend", handleTouchEnd);
});
</script>

<style scoped>
.slide {
  width: 100%;
  height: 100vh;
  display: none;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  text-align: center;
  padding: 20px;
  box-sizing: border-box;
  background: linear-gradient(45deg, #16213e, #0f3460);
}

.slide.active {
  display: flex;
}

h1,
h2 {
  color: #16c79a;
  text-shadow: 2px 2px #0f3460;
}

p,
li {
  font-size: 1.5em;
  line-height: 1.4;
  max-width: 800px;
  text-shadow: 1px 1px #0f3460;
}

ul {
  text-align: left;
  list-style-type: none;
  padding-left: 0;
}

li::before {
  content: "▶ ";
  color: #16c79a;
}

.cube-word {
  font-size: 3em;
  font-weight: bold;
  transform: rotate(-5deg) skew(-5deg);
  margin: 10px;
  display: inline-block;
  background: #16c79a;
  color: #1a1a2e;
  padding: 10px;
  box-shadow: 5px 5px #e94560;
}

.qr-container {
  display: flex;
  justify-content: space-around;
  width: 100%;
  margin: 20px 0;
}

.qr-code {
  text-align: center;
}

.qr-code img {
  width: 150px;
  height: 150px;
  background-color: #fff;
  padding: 10px;
  border: 2px solid #16c79a;
}

.token-table {
  border-collapse: collapse;
  margin: 20px auto;
  font-size: 1.2em;
}

.token-table th,
.token-table td {
  border: 1px solid #16c79a;
  padding: 10px;
}

.token-table th {
  background-color: #16c79a;
  color: #1a1a2e;
}

.highlight {
  color: #16c79a;
  font-weight: bold;
}
</style>
