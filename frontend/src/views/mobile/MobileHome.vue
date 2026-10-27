<script setup>
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'

import { useBacklogStore } from '@/composables/useBacklogStore'

const router = useRouter()
const { state, loadAll } = useBacklogStore()
// Relative to the app's own location, so it works under a path prefix.
const iconUrl = new URL('img/icon.svg', document.baseURI).pathname

const TYPES = [
  { id: 'work', label: 'Work' },
  { id: 'argonath', label: 'Argonath' },
]
const OPEN_STATES = ['BACKLOG', 'TODO', 'ONGOING']

function projectsOf(type) {
  return state.projects.filter((p) => p.type === type)
}

function openCount(type) {
  const ids = new Set(projectsOf(type).map((p) => p.id))
  return state.items.filter((i) => ids.has(i.projectId) && OPEN_STATES.includes(i.state)).length
}

function openBoard(type) {
  state.activeProjectType = type
  state.currentProjectId = 'ALL'
  state.activeTags = new Set()
  router.push({ name: 'boards', query: { type } })
}

onMounted(() => {
  loadAll()
})
</script>

<template>
  <main class="m-screen">
    <header class="m-topbar">
      <img :src="iconUrl" alt="" width="22" height="22" />
      <span class="m-topbar-title">Backlog Manager</span>
    </header>

    <p class="m-intro">Which project group?</p>

    <div class="m-type-list">
      <button
        v-for="t in TYPES"
        :key="t.id"
        class="m-type-card"
        :class="`is-${t.id}`"
        @click="openBoard(t.id)"
      >
        <span class="m-type-name">{{ t.label }}</span>
        <span class="m-type-meta">
          {{ projectsOf(t.id).length }} {{ projectsOf(t.id).length === 1 ? 'project' : 'projects' }}
          · {{ openCount(t.id) }} open {{ openCount(t.id) === 1 ? 'item' : 'items' }}
        </span>
        <span class="m-type-chevron" aria-hidden="true">›</span>
      </button>
    </div>
  </main>
</template>
