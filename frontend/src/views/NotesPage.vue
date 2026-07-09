<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { marked } from 'marked'

import NotesTree from '@/components/notes/NotesTree.vue'
import ConvertScratchpadModal from '@/components/notes/ConvertScratchpadModal.vue'
import { useBacklogStore } from '@/composables/useBacklogStore'
import { useModal } from '@/composables/useModal'
import { showToast } from '@/composables/useToast'
import { debounce } from '@/utils/debounce'
import * as notesService from '@/services/notes.service'
import * as scratchpadsService from '@/services/scratchpads.service'

const { state, syncMutation, generateId, loadAll } = useBacklogStore()
const { showConfirm } = useModal()
const route = useRoute()
const router = useRouter()

const selectedNoteId = ref(null)
const selectedScratchpad = ref(false)
const noteTitle = ref('')
const noteContent = ref('')
const showConvertModal = ref(false)
const scratchpadInputRef = ref(null)
const noteTitleInputRef = ref(null)

onMounted(async () => {
  await loadAll()
  const q = route.query
  if (q.type) state.activeProjectType = q.type
  if (q.scratchpad) {
    selectedScratchpad.value = true
  } else if (q.note) {
    selectNote(q.note)
  }
})

function syncUrl() {
  const query = {}
  if (state.activeProjectType !== 'work') query.type = state.activeProjectType
  if (selectedScratchpad.value) query.scratchpad = '1'
  else if (selectedNoteId.value) query.note = selectedNoteId.value
  router.replace({ query })
}

watch(() => state.activeProjectType, syncUrl)

const selectedNote = computed(() => state.notes.find((n) => n.id === selectedNoteId.value) || null)
const notePreviewHtml = computed(() => marked.parse(noteContent.value || ''))
const noteProjectName = computed(() => {
  const note = selectedNote.value
  if (!note) return ''
  return state.projects.find((p) => p.id === note.projectId)?.name || note.projectId
})

const scratchpad = computed(() => state.scratchpads[state.activeProjectType] || { content: '' })

function selectNote(noteId) {
  const note = state.notes.find((n) => n.id === noteId)
  if (!note) return
  selectedNoteId.value = noteId
  selectedScratchpad.value = false
  noteTitle.value = note.title || ''
  noteContent.value = note.content || ''
  syncUrl()
}

function selectScratchpad() {
  selectedScratchpad.value = true
  selectedNoteId.value = null
  syncUrl()
}

const debouncedSaveNote = debounce((noteId, patch) => {
  syncMutation(() => notesService.updateNote(noteId, patch), { errorMessage: 'Failed to save note' })
}, 1000)

const debouncedSaveScratchpad = debounce(() => {
  syncMutation(() => scratchpadsService.updateScratchpad(state.activeProjectType, scratchpad.value), {
    errorMessage: 'Failed to save scratchpad',
  })
}, 1000)

function onTitleInput() {
  const note = selectedNote.value
  if (!note) return
  note.title = noteTitle.value || 'Untitled note'
  note.updatedAt = Date.now()
  debouncedSaveNote(note.id, { title: note.title, content: note.content })
}

function onContentInput() {
  const note = selectedNote.value
  if (!note) return
  note.content = noteContent.value || ''
  note.updatedAt = Date.now()
  debouncedSaveNote(note.id, { title: note.title, content: note.content })
}

function saveNoteNow() {
  const note = selectedNote.value
  if (!note) return
  note.title = noteTitle.value || 'Untitled note'
  note.content = noteContent.value || ''
  note.updatedAt = Date.now()
  syncMutation(() => notesService.updateNote(note.id, { title: note.title, content: note.content }), {
    errorMessage: 'Failed to save note',
  })
}

async function deleteCurrentNote() {
  const note = selectedNote.value
  if (!note) return
  const ok = await showConfirm('Delete note', `Delete "${note.title}"? This cannot be undone.`)
  if (!ok) return
  state.notes = state.notes.filter((n) => n.id !== note.id)
  selectedNoteId.value = null
  syncUrl()
  syncMutation(() => notesService.deleteNote(note.id), { errorMessage: 'Failed to delete note' })
}

async function deleteNote(note) {
  if (note.id === selectedNoteId.value) selectedNoteId.value = null
  state.notes = state.notes.filter((n) => n.id !== note.id)
  syncUrl()
  syncMutation(() => notesService.deleteNote(note.id), { errorMessage: 'Failed to delete note' })
}

function createNoteForProject(projectId) {
  const note = {
    id: 'note-' + generateId(),
    projectId,
    releaseId: null,
    title: 'Untitled note',
    content: '',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
  state.notes.push(note)
  selectNote(note.id)
  nextTick(() => noteTitleInputRef.value?.focus())
  syncMutation(() => notesService.createNote(note), { errorMessage: 'Failed to create note' })
}

// --- Scratchpad ---

function onScratchpadInput(e) {
  scratchpad.value.content = e.target.value || ''
  scratchpad.value.updatedAt = Date.now()
  debouncedSaveScratchpad()
}

function insertTimestamp() {
  const el = scratchpadInputRef.value
  if (!el) return
  const now = new Date().toLocaleString()
  const start = el.selectionStart
  const end = el.selectionEnd
  const before = el.value.substring(0, start)
  const after = el.value.substring(end)
  el.value = `${before}[${now}]${after}`
  el.selectionStart = el.selectionEnd = start + now.length + 2
  scratchpad.value.content = el.value
  scratchpad.value.updatedAt = Date.now()
  debouncedSaveScratchpad()
  el.focus()
}

async function clearScratchpad() {
  const ok = await showConfirm('Clear scratchpad', 'Are you sure? This will delete all unsaved content.')
  if (!ok) return
  scratchpad.value.content = ''
  syncMutation(() => scratchpadsService.updateScratchpad(state.activeProjectType, scratchpad.value), {
    errorMessage: 'Failed to save scratchpad',
  })
}

function convertScratchpadToNote() {
  if (!scratchpad.value.content.trim()) {
    showToast('Scratchpad is empty')
    return
  }
  const scopeProjects = state.projects.filter((p) => p.type === state.activeProjectType)
  if (scopeProjects.length === 0) {
    showToast('No projects available for this type')
    return
  }
  showConvertModal.value = true
}

function doConvert({ projectId, title, keepScratchpad }) {
  const note = {
    id: 'note-' + generateId(),
    projectId,
    releaseId: null,
    title,
    content: scratchpad.value.content,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
  state.notes.push(note)
  if (!keepScratchpad) {
    scratchpad.value.content = ''
    syncMutation(() => scratchpadsService.updateScratchpad(state.activeProjectType, scratchpad.value), {
      errorMessage: 'Failed to save scratchpad',
    })
  }
  showConvertModal.value = false
  selectNote(note.id)
  syncMutation(() => notesService.createNote(note), { errorMessage: 'Failed to create note' }).then(() => {
    showToast('Note created from scratchpad')
  })
}
</script>

<template>
  <div class="layout">
    <div class="notes-layout">
      <div class="notes-left-pane">
        <div class="notes-tree-header"><span>Notes</span></div>
        <NotesTree
          :selected-note-id="selectedNoteId"
          :selected-scratchpad="selectedScratchpad"
          @select-note="selectNote"
          @select-scratchpad="selectScratchpad"
          @add-note="createNoteForProject"
          @delete-note="deleteNote"
        />
      </div>
      <div class="notes-right-pane">
        <div v-if="!selectedNote && !selectedScratchpad" class="notes-editor-empty">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
          </svg>
          <div class="notes-editor-empty-text">Select a note to edit</div>
          <div class="notes-editor-empty-sub">Choose a note from the tree or create a new one</div>
        </div>

        <div v-else-if="selectedNote" class="notes-editor-content">
          <div class="notes-editor-header">
            <input ref="noteTitleInputRef" v-model="noteTitle" type="text" class="note-title-input" placeholder="Note title" @input="onTitleInput" />
            <span class="note-context-label">{{ noteProjectName }}</span>
            <button class="btn-inline" @click="saveNoteNow">Save</button>
            <button class="btn-inline" @click="deleteCurrentNote">Delete</button>
          </div>
          <div class="notes-editor-body">
            <textarea
              v-model="noteContent"
              class="note-content-input"
              placeholder="Write Markdown notes here..."
              @input="onContentInput"
            ></textarea>
            <div class="note-preview" v-html="notePreviewHtml"></div>
          </div>
        </div>

        <div v-else class="notes-scratchpad-editor">
          <div class="scratchpad-header">
            <span class="scratchpad-title">Scratchpad</span>
            <span class="scratchpad-status">Quick capture, autosaved</span>
          </div>
          <div class="scratchpad-body">
            <textarea
              ref="scratchpadInputRef"
              class="scratchpad-input"
              placeholder="Jot something down..."
              :value="scratchpad.content"
              @input="onScratchpadInput"
            ></textarea>
          </div>
          <div class="scratchpad-footer">
            <button class="btn-inline-sm" @click="insertTimestamp">Insert timestamp</button>
            <button class="btn-inline-sm" @click="convertScratchpadToNote">Convert to note</button>
            <button class="btn-inline-sm" @click="clearScratchpad">Clear</button>
          </div>
        </div>
      </div>
    </div>
  </div>

  <ConvertScratchpadModal :open="showConvertModal" @close="showConvertModal = false" @convert="doConvert" />
</template>
