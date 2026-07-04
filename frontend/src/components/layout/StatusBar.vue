<script setup>
import { useBacklogStore } from '@/composables/useBacklogStore'

const { state } = useBacklogStore()
</script>

<template>
  <div class="status-bar">
    <div class="status-left">
      <div class="status-indicator"></div>
      <span>{{ state.config.dataFile ? `Data file: ${state.config.dataFile}` : 'Data file: (loading...)' }}</span>
    </div>
    <div class="status-right"></div>
  </div>
</template>
