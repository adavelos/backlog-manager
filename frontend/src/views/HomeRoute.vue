<script setup>
import { defineAsyncComponent } from 'vue'

import { useIsMobile } from '@/composables/useIsMobile'

const isMobile = useIsMobile()
const HomePage = defineAsyncComponent(() => import('@/views/HomePage.vue'))
const MobileHome = defineAsyncComponent(() => import('@/views/mobile/MobileHome.vue'))
</script>

<template>
  <MobileHome v-if="isMobile" />
  <HomePage v-else />
</template>
