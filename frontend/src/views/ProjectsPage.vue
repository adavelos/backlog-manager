<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import ManageList from '@/components/projects/ManageList.vue'
import AddProjectModal from '@/components/projects/AddProjectModal.vue'
import ProjectDetailModal from '@/components/projects/ProjectDetailModal.vue'
import ReleaseDetailModal from '@/components/projects/ReleaseDetailModal.vue'
import { useBacklogStore } from '@/composables/useBacklogStore'
import { useModal } from '@/composables/useModal'
import * as projectsService from '@/services/projects.service'

const { state, syncMutation, generateId } = useBacklogStore()
const { showConfirm, showPrompt } = useModal()
const route = useRoute()
const router = useRouter()

const selectedProjectId = ref(null)
const showAddProject = ref(false)
const editingProjectId = ref(null)
const editingReleaseId = ref(null)

onMounted(() => {
  const q = route.query
  if (q.type) state.activeProjectType = q.type
  if (q.sel) selectedProjectId.value = q.sel
})

watch(() => state.activeProjectType, syncUrl)

function syncUrl() {
  const query = {}
  if (state.activeProjectType !== 'work') query.type = state.activeProjectType
  if (selectedProjectId.value) query.sel = selectedProjectId.value
  router.replace({ query })
}

const scopeProjects = computed(() =>
  state.projects
    .filter((p) => p.type === state.activeProjectType)
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)),
)

const selectedProject = computed(() => state.projects.find((p) => p.id === selectedProjectId.value) || null)

const releases = computed(() =>
  selectedProject.value
    ? (selectedProject.value.releases || []).slice().sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
    : [],
)

const editingProject = computed(() => state.projects.find((p) => p.id === editingProjectId.value) || null)
const editingRelease = computed(() => releases.value.find((r) => r.id === editingReleaseId.value) || null)

function releaseStateGlyph(release) {
  return release.state === 'ACTIVE' ? '●' : release.state === 'PLANNED' ? '○' : '×'
}

function selectProject(project) {
  selectedProjectId.value = project.id
  syncUrl()
}

function goToBoard(project) {
  state.currentProjectId = project.id
  router.push({ path: '/boards', query: { project: project.id } })
}

// --- Project CRUD ---

function computeSortOrder(prevItem, nextItem) {
  const prev = prevItem ? prevItem.sortOrder : null
  const next = nextItem ? nextItem.sortOrder : null
  if (prev == null && next == null) return 0
  if (prev == null) return next - 1
  if (next == null) return prev + 1
  return (prev + next) / 2
}

function createProject({ name, description, key }) {
  const maxOrder = scopeProjects.value.reduce((max, p) => Math.max(max, p.sortOrder || 0), 0)
  const project = {
    id: 'proj-' + generateId(),
    name,
    key,
    description: description || '',
    type: state.activeProjectType,
    repoPath: '',
    sortOrder: maxOrder + 1,
    releases: [],
  }
  state.projects.push(project)
  selectedProjectId.value = project.id
  showAddProject.value = false
  syncUrl()
  syncMutation(() => projectsService.createProject(project), { errorMessage: 'Failed to create project' })
}

function saveProject(payload) {
  const project = editingProject.value
  if (!project) return
  Object.assign(project, payload)
  editingProjectId.value = null
  syncMutation(() => projectsService.updateProject(project.id, payload), { errorMessage: 'Failed to save project' })
}

async function deleteProjectById(projectId) {
  const project = state.projects.find((p) => p.id === projectId)
  if (!project) return
  const ok = await showConfirm('Delete project', `Delete "${project.name}" and all its items? This cannot be undone.`)
  if (!ok) return

  state.projects = state.projects.filter((p) => p.id !== projectId)
  state.items = state.items.filter((item) => item.projectId !== projectId)
  state.notes = state.notes.filter((note) => note.projectId !== projectId)
  if (selectedProjectId.value === projectId) selectedProjectId.value = null
  if (state.currentProjectId === projectId) state.currentProjectId = 'ALL'
  editingProjectId.value = null
  syncUrl()
  syncMutation(() => projectsService.deleteProject(projectId), { errorMessage: 'Failed to delete project' })
}

function reorderProjects(orderedIds) {
  const sorted = orderedIds.map((id) => state.projects.find((p) => p.id === id)).filter(Boolean)
  sorted.forEach((p, idx) => {
    p.sortOrder = computeSortOrder(sorted[idx - 1] || null, sorted[idx + 1] || null)
  })
  sorted.forEach((p) => {
    syncMutation(() => projectsService.updateProject(p.id, { sortOrder: p.sortOrder }), {
      errorMessage: 'Failed to reorder project',
    })
  })
}

// --- Release CRUD ---

async function addRelease() {
  if (!selectedProject.value) {
    await showPrompt('No project selected', 'Select a project first, then add a release.', '')
    return
  }
  const name = await showPrompt('New release', '', 'Release name')
  if (!name) return

  const project = selectedProject.value
  if (!project.releases) project.releases = []
  const maxOrder = project.releases.reduce((max, r) => Math.max(max, r.sortOrder || 0), 0)
  const release = {
    id: 'rel-' + generateId(),
    name,
    state: 'PLANNED',
    description: '',
    startDate: null,
    endDate: null,
    note: '',
    sortOrder: maxOrder + 1,
  }
  project.releases.push(release)
  syncMutation(() => projectsService.createRelease(project.id, release), { errorMessage: 'Failed to create release' })
}

function saveRelease(payload) {
  const release = editingRelease.value
  if (!release) return
  Object.assign(release, payload)
  editingReleaseId.value = null
  syncMutation(() => projectsService.updateRelease(release.id, payload), { errorMessage: 'Failed to save release' })
}

async function deleteReleaseById(releaseId) {
  const project = selectedProject.value
  if (!project) return
  const release = (project.releases || []).find((r) => r.id === releaseId)
  if (!release) return
  const ok = await showConfirm('Delete release', `Delete release "${release.name}"? Items in it will become unreleased.`)
  if (!ok) return

  project.releases = project.releases.filter((r) => r.id !== releaseId)
  state.items.forEach((item) => {
    if (item.projectId === project.id && item.releaseId === releaseId) item.releaseId = null
  })
  state.notes = state.notes.filter((note) => !(note.projectId === project.id && note.releaseId === releaseId))
  editingReleaseId.value = null
  syncMutation(() => projectsService.deleteRelease(releaseId), { errorMessage: 'Failed to delete release' })
}

function reorderReleases(orderedIds) {
  const project = selectedProject.value
  if (!project) return
  const sorted = orderedIds.map((id) => (project.releases || []).find((r) => r.id === id)).filter(Boolean)
  sorted.forEach((r, idx) => {
    r.sortOrder = computeSortOrder(sorted[idx - 1] || null, sorted[idx + 1] || null)
  })
  sorted.forEach((r) => {
    syncMutation(() => projectsService.updateRelease(r.id, { sortOrder: r.sortOrder }), {
      errorMessage: 'Failed to reorder release',
    })
  })
}
</script>

<template>
  <div class="layout">
    <div class="manage-layout">
      <div class="manage-column">
        <div class="manage-header">
          <span>Projects</span>
          <button class="btn-outline" @click="showAddProject = true">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
            Add project
          </button>
        </div>
        <ManageList :items="scopeProjects" :selected-id="selectedProjectId" @reorder="reorderProjects" @item-click="selectProject">
          <template #empty>
            <div class="empty-state">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
              </svg>
              <div class="empty-state-text">No {{ state.activeProjectType }} projects yet</div>
              <div class="empty-state-sub">Click "Add project" to create one</div>
            </div>
          </template>
          <template #default="{ item: project }">
            <span class="drag-handle" title="Drag to reorder">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.5" /><circle cx="15" cy="6" r="1.5" /><circle cx="9" cy="12" r="1.5" /><circle cx="15" cy="12" r="1.5" /><circle cx="9" cy="18" r="1.5" /><circle cx="15" cy="18" r="1.5" /></svg>
            </span>
            <span class="order-badge">{{ scopeProjects.indexOf(project) + 1 }}</span>
            <div class="manage-item-content">
              <div class="manage-item-title"><span class="project-key">[{{ project.key }}]</span> {{ project.name }}</div>
              <div v-if="project.description" class="manage-item-desc">{{ project.description }}</div>
            </div>
            <span v-if="project.type === 'argonath'" class="badge type-argonath">Argonath</span>
            <span class="manage-item-actions">
              <button class="manage-item-action" title="Go to board" @click.stop="goToBoard(project)">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
                  <rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
                </svg>
              </button>
              <button class="manage-item-action" title="Edit project" @click.stop="editingProjectId = project.id">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </button>
              <button class="manage-item-action danger" title="Delete project" @click.stop="deleteProjectById(project.id)">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
              </button>
            </span>
          </template>
        </ManageList>
      </div>

      <div class="manage-column">
        <div class="manage-header">
          <span>{{ selectedProject ? `Releases — ${selectedProject.name}` : 'Releases' }}</span>
          <button class="btn-outline" @click="addRelease">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
            Add release
          </button>
        </div>
        <ManageList v-if="selectedProject" :items="releases" @reorder="reorderReleases" @item-click="(r) => (editingReleaseId = r.id)">
          <template #empty>
            <div class="empty-state">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 2H2v10l9.29 9.29a2 2 0 0 0 2.83 0l6.17-6.17a2 2 0 0 0 0-2.83L12 2z" />
                <circle cx="7" cy="7" r="1" fill="currentColor" />
              </svg>
              <div class="empty-state-text">No releases</div>
              <div class="empty-state-sub">Click "Add release" to create one</div>
            </div>
          </template>
          <template #default="{ item: release }">
            <span class="drag-handle" title="Drag to reorder">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.5" /><circle cx="15" cy="6" r="1.5" /><circle cx="9" cy="12" r="1.5" /><circle cx="15" cy="12" r="1.5" /><circle cx="9" cy="18" r="1.5" /><circle cx="15" cy="18" r="1.5" /></svg>
            </span>
            <span class="order-badge">{{ releases.indexOf(release) + 1 }}</span>
            <div class="manage-item-content">
              <div class="manage-item-title">{{ release.name }}  {{ releaseStateGlyph(release) }}</div>
              <div v-if="release.description" class="manage-item-desc">{{ release.description }}</div>
            </div>
            <span class="manage-item-actions">
              <button class="manage-item-action" title="Edit release" @click.stop="editingReleaseId = release.id">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </button>
              <button class="manage-item-action danger" title="Delete release" @click.stop="deleteReleaseById(release.id)">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
              </button>
            </span>
          </template>
        </ManageList>
        <div v-else class="manage-list">
          <div class="empty-state">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 2H2v10l9.29 9.29a2 2 0 0 0 2.83 0l6.17-6.17a2 2 0 0 0 0-2.83L12 2z" />
              <circle cx="7" cy="7" r="1" fill="currentColor" />
            </svg>
            <div class="empty-state-text">Select a project</div>
            <div class="empty-state-sub">Choose a project to see its releases</div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <AddProjectModal :open="showAddProject" @close="showAddProject = false" @create="createProject" />
  <ProjectDetailModal :project="editingProject" @close="editingProjectId = null" @save="saveProject" @delete="deleteProjectById($event.id)" />
  <ReleaseDetailModal :release="editingRelease" @close="editingReleaseId = null" @save="saveRelease" @delete="deleteReleaseById($event.id)" />
</template>
