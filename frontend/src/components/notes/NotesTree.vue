<script setup>
import { computed, reactive } from 'vue'

import { useBacklogStore } from '@/composables/useBacklogStore'
import { useModal } from '@/composables/useModal'

const props = defineProps({
  selectedNoteId: { type: String, default: null },
  selectedScratchpad: { type: Boolean, default: false },
})
const emit = defineEmits(['select-note', 'select-scratchpad', 'add-note', 'delete-note'])

const { state } = useBacklogStore()
const { showConfirm } = useModal()
const collapsed = reactive(new Set())

const scopeProjects = computed(() =>
  state.projects
    .filter((p) => p.type === state.activeProjectType)
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)),
)

function notesForProject(projectId) {
  return state.notes.filter((n) => n.projectId === projectId)
}

function toggleCollapsed(projectId) {
  if (collapsed.has(projectId)) collapsed.delete(projectId)
  else collapsed.add(projectId)
}

async function confirmDelete(note) {
  const ok = await showConfirm('Delete note', `Delete "${note.title}"? This cannot be undone.`)
  if (ok) emit('delete-note', note)
}
</script>

<template>
  <div class="notes-tree">
    <div class="notes-scratchpad-entry">
      <button class="scratchpad-btn" :class="{ active: selectedScratchpad }" @click="emit('select-scratchpad')">
        📝 Scratchpad
      </button>
    </div>

    <div v-if="scopeProjects.length === 0" class="empty-state">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
      <div class="empty-state-text">No projects yet</div>
      <div class="empty-state-sub">Create a {{ state.activeProjectType }} project to add notes</div>
    </div>

    <div
      v-for="project in scopeProjects"
      :key="project.id"
      class="notes-tree-project"
      :class="{ collapsed: collapsed.has(project.id) }"
    >
      <div class="notes-tree-project-header">
        <span @click="toggleCollapsed(project.id)">{{ project.name }}</span>
        <button class="btn-inline-sm" @click.stop="emit('add-note', project.id)">+ Note</button>
      </div>
      <div v-if="notesForProject(project.id).length > 0" class="notes-tree-notes">
        <div v-for="note in notesForProject(project.id)" :key="note.id" class="notes-tree-note-row">
          <button
            class="notes-tree-note"
            :class="{ active: note.id === selectedNoteId }"
            @click="emit('select-note', note.id)"
          >
            {{ note.title || 'Untitled note' }}
          </button>
          <button class="notes-tree-note-delete" title="Delete note" @click.stop="confirmDelete(note)">&times;</button>
        </div>
      </div>
    </div>
  </div>
</template>
