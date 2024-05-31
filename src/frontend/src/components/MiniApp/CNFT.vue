<template>
  <el-row justify="end">
    <el-col :span="10"> <div id="ton-connect"></div></el-col>
  </el-row>
  <div>
    <h1>Claim your own cNFT!</h1>
    <div v-if="userStorage.wallet">
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

<script setup lang="ts">
import { ref, watch, onMounted } from "vue";
import { MainButton, useWebAppHapticFeedback, useWebApp } from "vue-tg";
import { useUserStore } from "../../stores/user";
import { Address, Cell, beginCell } from "@ton/core";
import { TonConnectUI } from "@tonconnect/ui";

const { notificationOccurred } = useWebAppHapticFeedback();

const miniapp = useWebApp();
const userStorage = useUserStore();

let metadata = ref();
let cnft = ref();

let tonConnectUI: TonConnectUI;

onMounted(async () => {
  tonConnectUI = new TonConnectUI({
    manifestUrl: "https://cubeworlds.club/tonconnect-manifest.json",
    buttonRootId: "ton-connect",
    // language: "ru",
    // uiPreferences: {
    //   theme: THEME.DARK,
    // },
    actionsConfiguration: {
      returnStrategy: "back",
      twaReturnUrl: "https://t.me/cube_worlds_bot/cnft",
    },
  });
  tonConnectUI.onStatusChange((wallet) => {
    console.info("Wallet updated: " + wallet);
    userStorage.setWallet(wallet ?? undefined);
  });
});

// TL-B schema: claim#013a3ca6 query_id:uint64 item_index:uint256 proof:^Cell = InternalMsgBody;
async function claim() {
  const cnft_index = BigInt(cnft.value.item.index);
  const cnft_proof = cnft.value.proof_cell;
  const query_id = 0;
  const proofCell = Cell.fromBase64(cnft_proof);

  const body = beginCell()
    .storeUint(0x013a3ca6, 32)
    .storeUint(query_id, 64)
    .storeUint(cnft_index, 256)
    .storeRef(proofCell)
    .endCell();

  const transaction = {
    validUntil: Math.floor(Date.now() / 1000) + 120,
    messages: [
      {
        address: "EQAaSqEwAh00YOCc9ZwtqfNcXeehbl97yKQKCZPRGwCov51V",
        amount: "85000000",
        payload: body.toBoc().toString("base64"),
      },
    ],
  };

  try {
    const result = await tonConnectUI.sendTransaction(transaction);
    console.info("Transaction was sent successfully, BOC: ", result.boc);
    notificationOccurred("success");
  } catch (e) {
    console.error("Transaction Error:", e);
    notificationOccurred("error");
  }
}

async function parseCNFT(wallet: string) {
  const baseUrl = "https://cubeworlds.club/cnfts"; // "http://localhost:8081";
  const url = `${baseUrl}/v1/address/${wallet}`;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Error: ${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    console.log("CNFT fetched successfully:", data);
    return data;
  } catch (error) {
    console.error("There was a problem with the fetch operation:", error);
  }
}

async function parseMetadata(wallet: string) {
  const baseUrl = `https://cubeworlds.club`; // `http://localhost:80`;
  const url = `${baseUrl}/api/nft/${wallet}`;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Error: ${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    console.log("Metadata fetched successfully:", data);
    return data;
  } catch (error) {
    console.error("There was a problem with the fetch operation:", error);
  }
}

watch(
  () => userStorage.wallet,
  async () => {
    if (!userStorage.wallet) {
      return;
    }
    const hexAddress = userStorage.wallet?.account.address;
    console.log(hexAddress);
    if (!hexAddress) {
      return;
    }
    const address = Address.parseRaw(hexAddress);
    const wallet = address.toString({ bounceable: false });
    metadata.value = await parseMetadata(wallet);
    cnft.value = await parseCNFT(wallet);
  }
);
</script>
