<template>
  <BackButton @click="handleBackButton" />
  <h1>FAQ</h1>
  <el-input v-model="filterText" placeholder="Filter keyword" />

  <el-tree
    ref="treeRef"
    style="width: 100%"
    class="filter-tree"
    :data="data"
    :props="defaultProps"
    :filter-node-method="filterNode"
  />
</template>

<script lang="ts" setup>
import { ref, watch } from "vue";
import { ElTree } from "element-plus";
import { BackButton, useWebAppBackButton } from "vue-tg";
import { useRouter } from "vue-router";

const router = useRouter();

function handleBackButton() {
    useWebAppBackButton().hideBackButton();
    router.back();
}

interface Tree {
    [key: string]: any;
}

const filterText = ref("");
const treeRef = ref<InstanceType<typeof ElTree>>();

const defaultProps = {
    children: "children",
    label: "label",
};

watch(filterText, (val) => {
    treeRef.value!.filter(val);
});

const filterNode = (value: string, data: Tree) => {
    if (!value) return true;
    return data.label.includes(value);
};

const data: Tree[] = [
    {
        label: "Когда минт?!",
        children: [
            {
                label: "Когда-нибудь.",
            },
        ],
    },
    {
        label: "Игра будет?",
        children: [
            {
                label: "Обязательно будет!",
            },
        ],
    },
];
</script>
