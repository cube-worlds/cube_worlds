<template>
  <!-- <el-row justify="end">
    <el-col :span="10"> <div id="ton-connect"></div></el-col>
  </el-row> -->
  <!-- <Header class="header" /> -->
  <RouterView />
  <!-- <Footer class="footer" /> -->
  <ClosingConfirmation />
  <ExpandedViewport />
</template>

<script lang="ts" setup>
import { ClosingConfirmation, ExpandedViewport } from "vue-tg";

// const userStorage = useUserStore();
</script>

<style>
.el-col {
  border-radius: 4px;
}

.grid-content {
  border-radius: 4px;
  min-height: 36px;
}

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
</style>
