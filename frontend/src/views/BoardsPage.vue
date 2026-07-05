<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import BoardColumn from '@/components/boards/BoardColumn.vue'
import QuickEditTable from '@/components/boards/QuickEditTable.vue'
import ArchivePanel from '@/components/boards/ArchivePanel.vue'
import ItemDetailModal from '@/components/boards/ItemDetailModal.vue'
import AddItemModal from '@/components/boards/AddItemModal.vue'
import { useBacklogStore } from '@/composables/useBacklogStore'
import { useModal } from '@/composables/useModal'
import * as itemsService from '@/services/items.service'

const { state, syncMutation, generateId, visibleBoardItems, archivedItems } = useBacklogStore()
const { showConfirm, showPrompt } = useModal()
const route = useRoute()
const router = useRouter()

const view = ref('state') // "state" | "release"
const quickEditMode = ref(false)
const showArchivePanel = ref(false)
const activePriorities = ref(new Set(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']))
const openItemId = ref(null)
const addItemTargetState = ref(null)

onMounted(() => {
  const q = route.query
  if (q.view) view.value = q.view
  if (q.project) state.currentProjectId = q.project
  if (q.type) state.activeProjectType = q.type
  if (q.tags) state.activeTags = new Set(String(q.tags).split(',').filter(Boolean))
  if (q.priorities) {
    const parsed = new Set(String(q.priorities).split(',').filter(Boolean))
    if (parsed.size > 0) activePriorities.value = parsed
  }
  if (q.qe) quickEditMode.value = true
  if (q.archive) showArchivePanel.value = true
})

watch(() => state.activeProjectType, syncUrl)

function syncUrl() {
  const query = {}
  if (view.value !== 'state') query.view = view.value
  if (state.currentProjectId !== 'ALL') query.project = state.currentProjectId
  if (state.activeProjectType !== 'work') query.type = state.activeProjectType
  if (state.activeTags.size > 0) query.tags = Array.from(state.activeTags).join(',')
  if (activePriorities.value.size > 0 && activePriorities.value.size < 4) {
    query.priorities = Array.from(activePriorities.value).join(',')
  }
  if (quickEditMode.value) query.qe = '1'
  if (showArchivePanel.value) query.archive = '1'
  router.replace({ query })
}

function togglePriority(priority) {
  if (activePriorities.value.has(priority)) activePriorities.value.delete(priority)
  else activePriorities.value.add(priority)
  syncUrl()
}

function toggleAllPriorities() {
  if (activePriorities.value.size === 4) {
    // If all are selected, deselect all
    activePriorities.value.clear()
  } else {
    // Otherwise select all
    activePriorities.value = new Set(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])
  }
  syncUrl()
}

const openItem = computed(() => (openItemId.value ? state.items.find((i) => i.id === openItemId.value) : null))

// --- Filter chips ---

const scopeProjects = computed(() =>
  state.projects
    .filter((p) => p.type === state.activeProjectType)
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)),
)

const allTags = computed(() => {
  const tags = new Set()
  state.items.forEach((item) => (item.tags || []).forEach((t) => tags.add(t)))
  return Array.from(tags).sort()
})

function selectProject(id) {
  state.currentProjectId = id
  syncUrl()
}

function toggleTag(tag) {
  if (state.activeTags.has(tag)) state.activeTags.delete(tag)
  else state.activeTags.add(tag)
  syncUrl()
}

function setView(v) {
  view.value = v
  quickEditMode.value = false
  syncUrl()
}

function setQuickEdit(on) {
  quickEditMode.value = on
  syncUrl()
}

function toggleArchive(e) {
  showArchivePanel.value = e.target.checked
  syncUrl()
}

const currentProject = computed(() => state.projects.find((p) => p.id === state.currentProjectId))
const activeReleases = computed(() =>
  currentProject.value
    ? (currentProject.value.releases || [])
        .filter((r) => r.state !== 'ARCHIVED')
        .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
    : [],
)

// --- Board columns (state view) ---

const STATES = ['BACKLOG', 'TODO', 'ONGOING', 'DONE']

const stateColumns = computed(() =>
  STATES.map((s) => ({
    id: s,
    label: s,
    items: visibleBoardItems.value.filter((i) => i.state === s && activePriorities.value.has((i.priority || '').toUpperCase())),
  })),
)

// --- Board columns (release view) ---

const releaseColumns = computed(() => {
  if (!currentProject.value) return []
  const cols = [{ id: 'NO_RELEASE', label: 'BACKLOG (no release)' }, ...activeReleases.value.map((r) => ({ id: r.id, label: r.name }))]
  return cols.map((c) => ({
    ...c,
    items: visibleBoardItems.value.filter(
      (i) => (i.releaseId || 'NO_RELEASE') === c.id && activePriorities.value.has((i.priority || '').toUpperCase()),
    ),
  }))
})

// --- Quick edit groups ---

function sortByPriority(items) {
  const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']
  return items.slice().sort((a, b) => {
    // First sort by priority (CRITICAL > HIGH > MEDIUM > LOW)
    const pA = PRIORITIES.indexOf((a.priority || '').toUpperCase())
    const pB = PRIORITIES.indexOf((b.priority || '').toUpperCase())
    if (pA !== pB) return pB - pA
    // Then sort by sortOrder within same priority
    const aSort = a.sortOrder || 0
    const bSort = b.sortOrder || 0
    if (aSort !== bSort) return aSort - bSort
    // Fall back to updatedAt
    return (b.updatedAt || 0) - (a.updatedAt || 0)
  })
}

const quickEditGroups = computed(() => {
  const cols = view.value === 'state' ? stateColumns.value : releaseColumns.value
  return cols.map((c) => ({ id: c.id, label: c.label, items: sortByPriority(c.items) }))
})

// --- Mutations: drag between state/release columns ---

function updateItemRemote(item, patch, errorMessage) {
  return syncMutation(() => itemsService.updateItem(item.id, patch), { errorMessage }).then((updated) => {
    if (updated) item.completedAt = updated.completedAt
  })
}

function onDropToStateColumn(targetState, itemId) {
  const item = state.items.find((i) => i.id === itemId)
  if (!item || item.state === targetState) return
  const prevState = item.state
  item.state = targetState
  item.updatedAt = Date.now()
  if (targetState === 'DONE') item.completedAt = Date.now()
  else if (prevState === 'DONE') item.completedAt = null
  updateItemRemote(item, { state: targetState }, 'Failed to move item')
}

function onDropToReleaseColumn(targetReleaseId, itemId) {
  const item = state.items.find((i) => i.id === itemId)
  if (!item) return
  const releaseId = targetReleaseId === 'NO_RELEASE' ? null : targetReleaseId
  if (item.releaseId === releaseId) return
  item.releaseId = releaseId
  item.updatedAt = Date.now()
  syncMutation(() => itemsService.updateItem(item.id, { releaseId }), { errorMessage: 'Failed to move item' })
}

// --- Mutations: quick edit ---

function onEditTitle({ itemId, title }) {
  const item = state.items.find((i) => i.id === itemId)
  if (!item) return
  item.title = title
  syncMutation(() => itemsService.updateItem(item.id, { title }), { errorMessage: 'Failed to save title' })
}

function computeSortOrder(prevItem, nextItem) {
  const prev = prevItem ? prevItem.sortOrder : null
  const next = nextItem ? nextItem.sortOrder : null
  if (prev == null && next == null) return 0
  if (prev == null) return next - 1
  if (next == null) return prev + 1
  return (prev + next) / 2
}

function onDropReorder({ draggedItemId, targetItemId, sortedItems }) {
  const draggedItem = state.items.find((i) => i.id === draggedItemId)
  const targetItem = state.items.find((i) => i.id === targetItemId)
  if (!draggedItem || !targetItem) return

  // Use the provided sorted items (from the column) to determine neighbors
  const itemsToConsider = sortedItems || state.items
  const draggedIdx = itemsToConsider.findIndex((i) => i.id === draggedItemId)
  const targetIdx = itemsToConsider.findIndex((i) => i.id === targetItemId)
  if (draggedIdx < 0 || targetIdx < 0) return

  // Simulate moving dragged item to position of target
  const reordered = itemsToConsider.filter((i) => i.id !== draggedItemId)
  const insertPos = reordered.findIndex((i) => i.id === targetItemId)

  // Determine insertion direction: if dragging downwards, insert after; otherwise before
  const isSortedIdxDraggedBeforeTarget = draggedIdx < targetIdx
  const adjustedInsertPos = isSortedIdxDraggedBeforeTarget ? insertPos + 1 : insertPos

  reordered.splice(adjustedInsertPos, 0, draggedItem)

  // Find neighbors in the reordered list
  const movedIdx = reordered.indexOf(draggedItem)
  const prevNeighbor = reordered[movedIdx - 1] || null
  const nextNeighbor = reordered[movedIdx + 1] || null
  draggedItem.sortOrder = computeSortOrder(prevNeighbor, nextNeighbor)

  syncMutation(() => itemsService.updateItem(draggedItem.id, { sortOrder: draggedItem.sortOrder }), {
    errorMessage: 'Failed to reorder item',
  })
}

function onDropMove({ draggedItemId, groupId }) {
  const item = state.items.find((i) => i.id === draggedItemId)
  if (!item) return
  const now = Date.now()
  if (view.value === 'state') {
    const prevState = item.state
    if (prevState === groupId) return
    item.state = groupId
    item.updatedAt = now
    if (groupId === 'DONE') item.completedAt = now
    else if (prevState === 'DONE') item.completedAt = null
    updateItemRemote(item, { state: groupId }, 'Failed to move item')
  } else {
    const releaseId = groupId === 'NO_RELEASE' ? null : groupId
    if (item.releaseId === releaseId) return
    item.releaseId = releaseId
    item.updatedAt = now
    syncMutation(() => itemsService.updateItem(item.id, { releaseId }), { errorMessage: 'Failed to move item' })
  }
}

// --- Item detail modal ---

function openItemDetail(itemId) {
  openItemId.value = itemId
}

function closeItemDetail() {
  openItemId.value = null
}

function saveItemDetail(payload) {
  const item = openItem.value
  if (!item) return
  Object.assign(item, payload)
  if (item.state === 'DONE' && !item.completedAt) item.completedAt = Date.now()
  else if (item.state !== 'DONE') item.completedAt = null
  item.updatedAt = Date.now()
  updateItemRemote(item, payload, 'Failed to save item')
  closeItemDetail()
}

async function deleteItemDetail(item) {
  const ok = await showConfirm('Delete item', `Delete "${item.title}"? This cannot be undone.`)
  if (!ok) return
  state.items = state.items.filter((i) => i.id !== item.id)
  closeItemDetail()
  syncMutation(() => itemsService.deleteItem(item.id), { errorMessage: 'Failed to delete item' })
}

// --- Add item modal ---

async function addItem(targetState) {
  const filteredProjects = scopeProjects.value
  if (filteredProjects.length === 0) {
    await showPrompt('No projects', 'Create a project first in Projects & Releases.', '')
    return
  }
  addItemTargetState.value = targetState
}

function closeAddItem() {
  addItemTargetState.value = null
}

function createItem(payload) {
  const targetState = addItemTargetState.value
  const item = {
    id: 'item-' + generateId(),
    projectId: payload.projectId,
    releaseId: payload.releaseId,
    title: payload.title,
    tags: payload.tags,
    priority: payload.priority,
    type: payload.type,
    state: targetState,
    analysis: payload.analysis,
    filesAffected: payload.filesAffected,
    prompt: payload.prompt,
    report: '',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    completedAt: null,
    subitems: [],
  }
  state.items.push(item)
  closeAddItem()
  syncMutation(() => itemsService.createItem(item), { errorMessage: 'Failed to create item' }).then((created) => {
    if (created) item.sortOrder = created.sortOrder
  })
}
</script>

<template>
  <div class="filters-panel">
    <div class="filter-row">
      <div class="filter-label">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
          <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
        </svg>
        <span>Projects</span>
      </div>
      <div class="chip-bar">
        <button class="chip chip-project" :class="{ active: state.currentProjectId === 'ALL' }" @click="selectProject('ALL')">
          All projects
        </button>
        <button
          v-for="p in scopeProjects"
          :key="p.id"
          class="chip chip-project"
          :class="{ active: state.currentProjectId === p.id }"
          @click="selectProject(p.id)"
        >
          {{ p.name }}
        </button>
      </div>
    </div>

    <div class="filter-row">
      <div class="filter-label">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2H2v10l9.29 9.29a2 2 0 0 0 2.83 0l6.17-6.17a2 2 0 0 0 0-2.83L12 2z" />
          <circle cx="7" cy="7" r="1" fill="currentColor" />
        </svg>
        <span>Tags</span>
      </div>
      <div class="chip-bar">
        <button
          v-for="tag in allTags"
          :key="tag"
          class="chip"
          :class="{ active: state.activeTags.has(tag) }"
          @click="toggleTag(tag)"
        >
          {{ tag }}
        </button>
      </div>
    </div>

    <div class="filter-row">
      <div class="filter-label">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M3 9h18" />
          <path d="M9 21V9" />
        </svg>
        <span>View</span>
      </div>
      <div class="view-selector">
        <div class="view-buttons">
          <button class="view-button" :class="{ active: view === 'state' }" @click="setView('state')">State board</button>
          <button
            class="view-button"
            :class="{ active: view === 'release' }"
            :disabled="state.currentProjectId === 'ALL'"
            @click="setView('release')"
          >
            Release board
          </button>
        </div>
        <div class="view-buttons qe-toggle-group">
          <button class="qe-toggle-button" :class="{ active: !quickEditMode }" @click="setQuickEdit(false)">Board</button>
          <button class="qe-toggle-button" :class="{ active: quickEditMode }" @click="setQuickEdit(true)">Quick Edit</button>
        </div>
        <div class="view-buttons">
          <button
            class="view-button"
            :class="{ active: activePriorities.size === 4 }"
            @click="toggleAllPriorities"
          >
            All
          </button>
          <button
            v-for="p in ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']"
            :key="p"
            class="view-button"
            :class="{ active: activePriorities.has(p) }"
            @click="togglePriority(p)"
          >
            {{ p }}
          </button>
        </div>
      </div>
      <label class="archive-toggle">
        <input type="checkbox" :checked="showArchivePanel" @change="toggleArchive" />
        <span>Archive panel</span>
      </label>
    </div>
  </div>

  <div class="layout">
    <span v-if="quickEditMode" class="qe-toggle-hint">
      Double-click title to edit. Enter to commit, Tab to next row, Esc to cancel.
    </span>

    <div class="boards-container">
      <ArchivePanel v-if="showArchivePanel" :items="archivedItems" />

      <template v-else>
        <div v-if="!quickEditMode" class="board">
          <template v-if="view === 'state'">
            <BoardColumn
              v-for="col in stateColumns"
              :key="col.id"
              :label="col.label"
              :items="col.items"
              :show-add-button="true"
              @add="addItem(col.id)"
              @drop="onDropToStateColumn(col.id, $event)"
              @drop-reorder="onDropReorder"
              @open="openItemDetail"
            />
          </template>
          <template v-else>
            <div v-if="state.currentProjectId === 'ALL'" style="padding: 12px; font-size: 12px; color: var(--text-muted)">
              Select a specific project to view the Release board.
            </div>
            <BoardColumn
              v-for="col in releaseColumns"
              :key="col.id"
              :label="col.label"
              :items="col.items"
              @drop="onDropToReleaseColumn(col.id, $event)"
              @drop-reorder="onDropReorder"
              @open="openItemDetail"
            />
          </template>
        </div>

        <div v-else class="qe-view">
          <div v-if="view === 'release' && state.currentProjectId === 'ALL'" style="padding: 12px; font-size: 12px; color: var(--text-muted)">
            Select a specific project to view the Release board.
          </div>
          <QuickEditTable
            v-else
            :groups="quickEditGroups"
            :show-state-column="view === 'release'"
            @edit-title="onEditTitle"
            @drop-reorder="onDropReorder"
            @drop-move="onDropMove"
          />
        </div>
      </template>
    </div>
  </div>

  <ItemDetailModal :item="openItem" @close="closeItemDetail" @save="saveItemDetail" @delete="deleteItemDetail" />
  <AddItemModal :target-state="addItemTargetState" :default-project-id="state.currentProjectId" @close="closeAddItem" @create="createItem" />
</template>
