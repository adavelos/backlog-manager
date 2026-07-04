<script setup>
import { useBacklogStore } from '@/composables/useBacklogStore'

const props = defineProps({ items: { type: Array, required: true } })

const { state } = useBacklogStore()

function projectName(item) {
  return state.projects.find((p) => p.id === item.projectId)?.name || item.projectId
}

function releaseName(item) {
  if (!item.releaseId) return '(no release)'
  const proj = state.projects.find((p) => p.id === item.projectId)
  if (!proj) return '(unknown)'
  const rel = (proj.releases || []).find((r) => r.id === item.releaseId)
  return rel ? rel.name : item.releaseId
}

function completedDate(item) {
  return item.completedAt ? new Date(item.completedAt).toLocaleDateString() : ''
}
</script>

<template>
  <div class="archive-panel">
    <div class="archive-header">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="2" y="3" width="20" height="5" rx="1" />
        <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" />
        <path d="M10 12h4" />
      </svg>
      <span>Archived DONE items (older than 7 days)</span>
    </div>
    <div class="archive-list">
      <div v-for="item in props.items" :key="item.id" class="archive-list-row">
        <span style="min-width: 120px">{{ projectName(item) }}</span>
        <span style="min-width: 100px">{{ releaseName(item) }}</span>
        <span class="archive-title" :title="item.title">{{ item.title }}</span>
        <span style="min-width: 90px">{{ completedDate(item) }}</span>
      </div>
    </div>
  </div>
</template>
