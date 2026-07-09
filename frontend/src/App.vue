<script setup>
import AppHeader from '@/components/layout/AppHeader.vue'
import StatusBar from '@/components/layout/StatusBar.vue'
import Modal from '@/components/common/Modal.vue'
import Toast from '@/components/common/Toast.vue'
</script>

<template>
  <div class="app-shell">
    <AppHeader />
    <router-view />
    <StatusBar />
  </div>
  <Modal />
  <Toast />
</template>
