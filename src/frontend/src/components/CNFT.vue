<template>
  <el-row justify="end">
    <el-col :span="10">
      <div id="ton-connect"></div>
    </el-col>
  </el-row>
  <div class="cnft-container">
    <h1>{{ $t("cnft-header") }}</h1>
    <div v-if="userStorage.wallet">
      <div v-if="metadata && eligible" class="cnft-content">
        <h3>{{ metadata?.name }}</h3>
        <img width="75%" :src="metadata?.image" />
        <p class="cnft-description">{{ metadata?.description }}</p>
        <div v-if="miniapp.isReady">
          <MainButton
            :text="$t(cnftExists ? 'cnft-show-button' : 'cnft-claim-button')"
            @click="tapButton"
          />
        </div>
        <div v-else>
          <button @click="tapButton">
            {{ $t(cnftExists ? "cnft-show-button" : "cnft-claim-button") }}
          </button>
        </div>
      </div>
      <div v-else>
        {{ $t("cnft-not-eligible") }}
      </div>
    </div>
    <div v-else>{{ $t("cnft-connect") }}</div>
  </div>
</template>

<style scoped>
.cnft-container {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
}

.cnft-content {
  border: 1px solid #ccc;
  border-radius: 8px;
  padding: 20px;
  margin-top: 20px;
}

.cnft-description {
  text-align: center;
  margin: 20px 0;
}
</style>

<script setup lang="ts">
import { ref, watch, onMounted, Ref } from "vue";
import { MainButton, useWebAppHapticFeedback, useWebApp } from "vue-tg";
import { useUserStore } from "../stores/user.js";
import { Address, Cell, beginCell } from "@ton/core";
import { TonConnectUI } from "@tonconnect/ui";
import { ElLoading, ElMessage } from "element-plus";
import { useAuth } from "../composables/use-auth.js";
import { useFluent } from "fluent-vue";
import { enBundle, ruBundle } from "../fluent.js";

const loadingInstance = ElLoading.service({ fullscreen: true, visible: false });

const { notificationOccurred } = useWebAppHapticFeedback();

const collectionAddress = "EQAaSqEwAh00YOCc9ZwtqfNcXeehbl97yKQKCZPRGwCov51V";

const miniapp = useWebApp();
const userStorage = useUserStore();
const fluent = useFluent();

let metadata = ref();
let cnft = ref();
let cnftExists = ref();
let eligible: Ref<Boolean> = ref(true);
let cnftAddress: Address | undefined = undefined;
let tonConnectUI: TonConnectUI;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

onMounted(async () => {
  const webAppUser = useWebApp().initDataUnsafe.user;
  if (webAppUser) {
    const { user, error, login } = useAuth(useWebApp().initData, webAppUser.id);
    await login();
    console.log(user.value, error.value);
    const lang = user.value.language;
    fluent.bundles.value = [lang === "ru" ? ruBundle : enBundle];
  }
  tonConnectUI = new TonConnectUI({
    manifestUrl: "https://cubeworlds.club/tonconnect-manifest.json",
    buttonRootId: "ton-connect",
    // language: "ru",
    // uiPreferences: {
    //   theme: THEME.DARK,
    // },
    actionsConfiguration: {
      returnStrategy: "back",
      twaReturnUrl: "https://t.me/cube_worlds_bot/cnft?startapp=from_wallet",
    },
  });
  tonConnectUI.onStatusChange((wallet) => {
    console.info("Wallet updated: " + wallet);
    userStorage.setWallet(wallet ?? undefined);
  });
});

async function tapButton() {
  if (cnftExists.value) {
    if (!cnftAddress) {
      console.error("Empty cNFT address");
      return;
    }
    window.open(
      `https://getgems.io/collection/${collectionAddress}/${cnftAddress.toString({
        urlSafe: true,
      })}`,
      "_blank"
    );
  } else {
    await claim();
  }
}

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
        address: collectionAddress,
        amount: "85000000",
        payload: body.toBoc().toString("base64"),
      },
    ],
  };

  try {
    const result = await tonConnectUI.sendTransaction(transaction);
    console.info("Transaction was sent successfully, BOC: ", result.boc);
    await runMintCheck();
    notificationOccurred("success");
  } catch (e) {
    showError(e);
    notificationOccurred("error");
  }
}

async function runMintCheck() {
  loadingInstance.visible.value = true;
  if (!cnft.value.item.index) {
    return;
  }
  while (true) {
    const nftExists = await isNftExists(cnft.value.item.index);
    if (nftExists) {
      cnftExists.value = true;
      loadingInstance.visible.value = false;
      return;
    }
    await sleep(3000);
  }
}

async function showError(error: unknown) {
  loadingInstance.visible.value = false;
  const message = (error as Error)?.message ?? error;
  ElMessage({
    showClose: true,
    message: message,
    type: "error",
  });
  console.error("There was a problem: ", message);
}

async function parseCNFT(wallet: string) {
  const baseUrl = "https://cubeworlds.club/cnfts"; // "http://localhost:8081";
  const url = `${baseUrl}/v1/address/${wallet}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Error: ${response.status} ${response.statusText}`);
  }
  const data = await response.json();
  console.log("CNFT fetched successfully:", data);
  return data;
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
    showError(error);
  }
}

async function isNftExists(nftIndex: number) {
  const url = `https://tonapi.io/v2/blockchain/accounts/${collectionAddress}/methods/get_nft_address_by_index?args=${nftIndex}`;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Error: ${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    console.log(data);
    const hexAddress = data.decoded.address;
    cnftAddress = Address.parseRaw(hexAddress);
    const accountUrl = `https://tonapi.io/v2/blockchain/accounts/${cnftAddress.toString({
      urlSafe: true,
    })}`;
    const responseAccount = await fetch(accountUrl);
    console.log(responseAccount.status);
    return responseAccount.status == 200;
  } catch (error) {
    console.log(error);
    return false;
  }
}

async function parseNftData(hexAddress: string) {
  const address = Address.parseRaw(hexAddress);
  const wallet = address.toString({ bounceable: false });
  try {
    cnft.value = await parseCNFT(wallet);
    eligible.value = true;
  } catch (error) {
    const message = (error as Error)?.message;
    if (message.includes("400 Bad Request")) {
      eligible.value = false;
    } else {
      showError(error);
    }
    return;
  }
  try {
    metadata.value = await parseMetadata(wallet);
    if (cnft.value.item.index) {
      cnftExists.value = await isNftExists(cnft.value.item.index);
    } else {
      cnftExists.value = false;
    }
    const isBackFromWallet = miniapp.initDataUnsafe.start_param === "from_wallet";
    if (isBackFromWallet) {
      await runMintCheck();
    }
  } catch (error) {
    await showError(error);
  }
}

watch(
  () => userStorage.wallet,
  async () => {
    if (!userStorage.wallet) {
      console.error("Empty wallet");
      return;
    }
    const hexAddress = userStorage.wallet?.account.address;
    if (!hexAddress) {
      console.error("No hex address");
      return;
    }
    loadingInstance.visible.value = true;
    try {
      await parseNftData(hexAddress);
      loadingInstance.visible.value = false;
    } catch (error) {
      await showError(error);
    }
  }
);
</script>
