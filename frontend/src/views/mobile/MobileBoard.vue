<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import ItemMoveSheet from '@/components/mobile/ItemMoveSheet.vue'
import { useBacklogStore } from '@/composables/useBacklogStore'
import { showToast } from '@/composables/useToast'
import * as itemsService from '@/services/items.service'

const route = useRoute()
const router = useRouter()
const { state, loadAll, visibleBoardItems, syncMutation } = useBacklogStore()

const STATES = [
  { id: 'BACKLOG', label: 'Backlog' },
  { id: 'TODO', label: 'To do' },
  { id: 'ONGOING', label: 'Ongoing' },
  { id: 'DONE', label: 'Done' },
]
const TYPES = [
  { id: 'work', label: 'Work' },
  { id: 'argonath', label: 'Argonath' },
]
const PRIORITY_RANK = { BLOCKER: 5, CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 }

const scroller = ref(null)
const activeIndex = ref(0)
const selectedId = ref(null)

const projects = computed(() =>
  state.projects
    .filter((p) => p.type === state.activeProjectType)
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)),
)

function byPriorityThenOrder(a, b) {
  const pa = PRIORITY_RANK[(a.priority || '').toUpperCase()] || 0
  const pb = PRIORITY_RANK[(b.priority || '').toUpperCase()] || 0
  if (pa !== pb) return pb - pa
  return (a.sortOrder || 0) - (b.sortOrder || 0)
}

const columns = computed(() =>
  STATES.map((s) => ({
    ...s,
    items: visibleBoardItems.value.filter((i) => i.state === s.id).sort(byPriorityThenOrder),
  })),
)

const selectedItem = computed(() => state.items.find((i) => i.id === selectedId.value) || null)

function setType(type) {
  if (state.activeProjectType === type) return
  state.activeProjectType = type
  state.currentProjectId = 'ALL'
  state.activeTags = new Set()
  router.replace({ query: { type } })
}

function setProject(id) {
  state.currentProjectId = id
}

// The columns scroll sideways with snap points; the tabs follow the scroll position and jump on tap.
function onScroll() {
  const el = scroller.value
  if (!el || !el.clientWidth) return
  activeIndex.value = Math.round(el.scrollLeft / el.clientWidth)
}

function goTo(index) {
  activeIndex.value = index
  const el = scroller.value
  if (el) el.scrollTo({ left: index * el.clientWidth, behavior: 'smooth' })
}

// Same optimistic update as the desktop board's state drop: change locally, then save; syncMutation
// reloads the server copy if the save fails.
function moveItem(item, target) {
  selectedId.value = null
  if (item.state === target) return
  const prev = item.state
  item.state = target
  item.updatedAt = Date.now()
  if (target === 'DONE') item.completedAt = Date.now()
  else if (prev === 'DONE') item.completedAt = null
  showToast(`Moved to ${STATES.find((s) => s.id === target).label}`)
  syncMutation(() => itemsService.updateItem(item.id, { state: target }), { errorMessage: 'Failed to move item' })
    .catch(() => {}) // syncMutation has already shown the error and reloaded
}

function doneCount(item) {
  return (item.subitems || []).filter((s) => s.done).length
}

onMounted(async () => {
  const type = route.query.type
  if (TYPES.some((t) => t.id === type)) state.activeProjectType = type
  await loadAll()
})
</script>

<template>
  <main class="m-screen m-board-screen">
    <header class="m-topbar">
      <router-link to="/" class="m-back" aria-label="Back to project groups">‹</router-link>
      <div class="m-segmented" role="group" aria-label="Project group">
        <button
          v-for="t in TYPES"
          :key="t.id"
          :class="{ active: state.activeProjectType === t.id }"
          :aria-pressed="state.activeProjectType === t.id"
          @click="setType(t.id)"
        >
          {{ t.label }}
        </button>
      </div>
    </header>

    <nav class="m-chips" aria-label="Project">
      <button class="m-chip" :class="{ active: state.currentProjectId === 'ALL' }" @click="setProject('ALL')">
        All
      </button>
      <button
        v-for="p in projects"
        :key="p.id"
        class="m-chip"
        :class="{ active: state.currentProjectId === p.id }"
        @click="setProject(p.id)"
      >
        {{ p.name }}
      </button>
    </nav>

    <div class="m-board-tabs" role="tablist">
      <button
        v-for="(c, i) in columns"
        :key="c.id"
        role="tab"
        class="m-board-tab"
        :class="{ active: activeIndex === i }"
        :aria-selected="activeIndex === i"
        @click="goTo(i)"
      >
        <span>{{ c.label }}</span>
        <span class="m-count">{{ c.items.length }}</span>
      </button>
    </div>

    <div ref="scroller" class="m-columns" @scroll.passive="onScroll">
      <section v-for="c in columns" :key="c.id" class="m-column" :aria-label="c.label">
        <ul v-if="c.items.length" class="m-cards">
          <li v-for="item in c.items" :key="item.id">
            <button class="m-card" @click="selectedId = item.id">
              <div class="m-card-meta">
                <span v-if="item.ticketId" class="item-ticket">{{ item.ticketId }}</span>
                <span v-if="item.priority" class="badge" :class="`priority-${item.priority}`">{{ item.priority }}</span>
              </div>
              <div class="m-card-title">{{ item.title }}</div>
              <div v-if="item.tags?.length || item.subitems?.length" class="m-card-meta">
                <span v-for="t in (item.tags || []).slice(0, 3)" :key="t" class="tag-badge">{{ t }}</span>
                <span v-if="item.tags?.length > 3" class="tag-badge">+{{ item.tags.length - 3 }}</span>
                <span v-if="item.subitems?.length" class="m-subitems">
                  {{ doneCount(item) }}/{{ item.subitems.length }} subtasks
                </span>
              </div>
            </button>
          </li>
        </ul>
        <p v-else class="m-empty">Nothing in {{ c.label.toLowerCase() }}.</p>
      </section>
    </div>

    <ItemMoveSheet
      v-if="selectedItem"
      :item="selectedItem"
      :states="STATES"
      @move="moveItem(selectedItem, $event)"
      @close="selectedId = null"
    />
  </main>
</template>
