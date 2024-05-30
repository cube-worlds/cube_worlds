<script setup lang="ts">
import { ref, onBeforeMount } from "vue";
import { MainButton, useWebAppHapticFeedback, useWebApp } from "vue-tg";

defineProps<{ wallet: string }>();

const { notificationOccurred } = useWebAppHapticFeedback();

const miniapp = useWebApp();
let metadata = ref(null as any);
let cnft = ref(null as any);

function claim() {
  notificationOccurred("success");
}

async function parseCNFT(wallet: string) {
  const baseUrl = "http://localhost:8081"; //https://cubeworlds.club/cnfts";
  const url = `${baseUrl}/v1/address/${wallet}`;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Error: ${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    console.log("Data fetched successfully:", data);
    return data;
  } catch (error) {
    console.error("There was a problem with the fetch operation:", error);
  }
}

async function parseMetadata(wallet: string) {
  const baseUrl = `http://localhost:80`; // `https://cubeworlds.club`;
  const url = `${baseUrl}/api/nft/${wallet}`;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Error: ${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    console.log("Data fetched successfully:", data);
    return data;
  } catch (error) {
    console.error("There was a problem with the fetch operation:", error);
  }
}

onBeforeMount(async () => {
  const wallet = "UQDCB9cdnWdWYYK8cgZDRjtuRQjxAqu8NubXBIcI2vMzHynx";
  metadata.value = await parseMetadata(wallet);
  cnft.value = await parseCNFT(wallet);
});
</script>

<template>
  <div>
    <h1>Claim your own cNFT!</h1>
    Your wallet: {{ wallet }}
    <div v-if="wallet">
      <div v-if="metadata">
        <h3>{{ metadata?.name }}</h3>
        <img width="320" :src="metadata?.image" />
        <p>{{ metadata?.description }}</p>

        <div v-if="cnft">
          <div v-if="miniapp.isReady.value">
            <MainButton @click="claim" :visible="true" />
          </div>
          <div v-else>
            <button @click="claim">Claim</button>
          </div>
        </div>
        <div v-else>Loading...</div>
      </div>
    </div>
    <div v-else>Connect your wallet to check the availability of your cNFT.</div>
  </div>
</template>
