<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import AppHeader from '@/components/layout/AppHeader.vue'
import StatusBar from '@/components/layout/StatusBar.vue'
import Modal from '@/components/common/Modal.vue'
import Toast from '@/components/common/Toast.vue'
import { useIsMobile } from '@/composables/useIsMobile'

// On a phone, the home and board screens bring their own top bar, so the desktop header and status bar are hidden.
// Projects and Notes keep the desktop chrome, which is their only navigation.
const route = useRoute()
const isMobile = useIsMobile()
const mobileScreen = computed(() => isMobile.value && ['home', 'boards'].includes(route.name))
</script>

<template>
  <div class="app-shell" :class="{ 'is-mobile': mobileScreen }">
    <AppHeader v-if="!mobileScreen" />
    <router-view />
    <StatusBar v-if="!mobileScreen" />
  </div>
  <Modal />
  <Toast />
</template>
