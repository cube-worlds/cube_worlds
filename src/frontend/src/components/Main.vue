<script setup lang="ts">
import { useWebApp } from "vue-tg";
import { useAuth } from "../composables/use-auth";
import { onMounted } from "vue";

defineProps<{ msg?: string }>();

onMounted(async () => {
  const webAppUser = useWebApp().initDataUnsafe.user;
  if (webAppUser) {
    const { user, error, login } = useAuth(useWebApp().initData, webAppUser.id);
    await login();
    console.log(user.value, error.value);
  }
});
</script>

<template>
  <h1>Welcome to Cube Worlds!</h1>

  <div class="card">
    Привет! У нас тут есть возможность получить игровой NFT, планируется жетон $CUBE...
    съешь ещё этих мягких французских булок, да выпей чаю. съешь ещё этих мягких
    французских булок, да выпей чаю съешь ещё этих мягких французских булок, да выпей чаю
    съешь ещё этих мягких французских булок, да выпей чаю съешь ещё этих мягких
    французских булок, да выпей чаю съешь ещё этих мягких французских булок, да выпей чаю
    съешь ещё этих мягких французских булок, да выпей чаю съешь ещё этих мягких
    французских булок, да выпей чаю съешь ещё этих мягких французских булок, да выпей чаю
    съешь ещё этих мягких французских булок, да выпей чаю съешь ещё этих мягких
    французских булок, да выпей чаю съешь ещё этих мягких французских булок, да выпей чаю
    съешь ещё этих мягких французских булок, да выпей чаю съешь ещё этих мягких
    французских булок, да выпей чаю съешь ещё этих мягких французских булок, да выпей чаю
    съешь ещё этих мягких французских булок, да выпей чаю съешь ещё этих мягких
    французских булок, да выпей чаю съешь ещё этих мягких французских булок, да выпей чаю
    съешь ещё этих мягких французских булок, да выпей чаю съешь ещё этих мягких
    французских булок, да выпей чаю съешь ещё этих мягких французских булок, да выпей чаю
    съешь ещё этих мягких французских булок, да выпей чаю
    <!-- <button type="button" @click="increment">Count is {{ count }}</button>
    <p>
      Edit
      <code>components/HelloWorld.vue</code> to test HMR
    </p> -->
    <!-- <MainButton :progress="true" :text="`Count is ${count}`" @click="increment" />
    <SettingsButton @click="increment" /> -->

    <!-- <RouterLink to="/faq">Go to FAQ</RouterLink> -->
  </div>
</template>
