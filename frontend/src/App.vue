<script setup>
import { onMounted } from 'vue'

import AppHeader from '@/components/layout/AppHeader.vue'
import StatusBar from '@/components/layout/StatusBar.vue'
import Modal from '@/components/common/Modal.vue'
import Toast from '@/components/common/Toast.vue'
import { useBacklogStore } from '@/composables/useBacklogStore'

const { loadAll } = useBacklogStore()

onMounted(() => {
  loadAll()
})
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
