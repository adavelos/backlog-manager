<script setup>
import { useRoute } from 'vue-router'

import AppHeader from '@/components/layout/AppHeader.vue'
import StatusBar from '@/components/layout/StatusBar.vue'
import Modal from '@/components/common/Modal.vue'
import Toast from '@/components/common/Toast.vue'

// Mobile screens (route meta `mobile`) bring their own top bar and have no desktop chrome.
const route = useRoute()
</script>

<template>
  <div class="app-shell" :class="{ 'is-mobile': route.meta.mobile }">
    <AppHeader v-if="!route.meta.mobile" />
    <router-view />
    <StatusBar v-if="!route.meta.mobile" />
  </div>
  <Modal />
  <Toast />
</template>
