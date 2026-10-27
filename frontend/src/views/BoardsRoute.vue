<script setup>
import { defineAsyncComponent } from 'vue'

import { useIsMobile } from '@/composables/useIsMobile'

const isMobile = useIsMobile()
const BoardsPage = defineAsyncComponent(() => import('@/views/BoardsPage.vue'))
const MobileBoard = defineAsyncComponent(() => import('@/views/mobile/MobileBoard.vue'))
</script>

<template>
  <MobileBoard v-if="isMobile" />
  <BoardsPage v-else />
</template>
