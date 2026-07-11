<script setup>
import { computed, nextTick, reactive, ref, watch } from 'vue'

import PriorityRadios from './PriorityRadios.vue'
import TypeRadios from './TypeRadios.vue'
import TagInput from './TagInput.vue'
import SubitemsEditor from './SubitemsEditor.vue'
import { useBacklogStore } from '@/composables/useBacklogStore'

const props = defineProps({
  targetState: { type: String, default: null },
  defaultProjectId: { type: String, default: null },
})
const emit = defineEmits(['close', 'create', 'create-and-new'])

const { state } = useBacklogStore()

const titleInputRef = ref(null)
const maximized = ref(false)

function toggleMaximize() {
  maximized.value = !maximized.value
}

const form = reactive({
  projectId: null,
  releaseId: '',
  title: '',
  analysis: '',
  priority: 'MEDIUM',
  type: 'FEATURE',
  tagsText: '',
  prompt: '',
  filesText: '',
  subitems: [],
})

const filteredProjects = computed(() =>
  state.projects
    .filter((p) => p.type === state.activeProjectType)
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)),
)

const releasesForProject = computed(() => {
  const project = state.projects.find((p) => p.id === form.projectId)
  return project ? project.releases || [] : []
})

watch(
  () => props.targetState,
  (targetState) => {
    if (!targetState) return
    const chosen =
      props.defaultProjectId && filteredProjects.value.some((p) => p.id === props.defaultProjectId)
        ? props.defaultProjectId
        : filteredProjects.value[0]?.id || null
    form.projectId = chosen
    form.releaseId = ''
    form.title = ''
    form.analysis = ''
    form.priority = 'MEDIUM'
    form.type = 'FEATURE'
    form.tagsText = ''
    form.prompt = ''
    form.filesText = ''
    form.subitems = []
    const activeRelease = releasesForProject.value.find((r) => r.state === 'ACTIVE')
    if (activeRelease) form.releaseId = activeRelease.id
    nextTick(() => titleInputRef.value?.focus())
  },
)

watch(
  () => form.projectId,
  () => {
    const activeRelease = releasesForProject.value.find((r) => r.state === 'ACTIVE')
    form.releaseId = activeRelease ? activeRelease.id : ''
  },
)

function splitList(text) {
  return text
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

function buildPayload() {
  const title = form.title.trim()
  if (!title) return null
  return {
    projectId: form.projectId,
    releaseId: form.releaseId || null,
    title,
    priority: form.priority,
    type: form.type,
    tags: splitList(form.tagsText),
    analysis: form.analysis.trim(),
    prompt: form.prompt.trim(),
    filesAffected: splitList(form.filesText),
    subitems: form.subitems,
  }
}

function resetForm() {
  form.title = ''
  form.analysis = ''
  form.priority = 'MEDIUM'
  form.type = 'FEATURE'
  form.tagsText = ''
  form.prompt = ''
  form.filesText = ''
  form.subitems = []
}

function create() {
  const payload = buildPayload()
  if (!payload) return
  emit('create', payload)
}

function saveAndNew() {
  const payload = buildPayload()
  if (!payload) return
  emit('create-and-new', payload)
  resetForm()
  nextTick(() => titleInputRef.value?.focus())
}
</script>

<template>
  <div v-if="targetState" class="modal-overlay" @click.self="emit('close')">
    <div class="modal-dialog" :class="{ maximized }">
      <div class="modal-header">
        <span>New {{ targetState }} item</span>
        <button class="modal-maximize-btn" :title="maximized ? 'Restore' : 'Maximize'" @click="toggleMaximize">
          <svg v-if="maximized" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="4 14 10 14 10 20" />
            <polyline points="20 10 14 10 14 4" />
            <line x1="14" y1="10" x2="21" y2="3" />
            <line x1="3" y1="21" x2="10" y2="14" />
          </svg>
          <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="15 3 21 3 21 9" />
            <polyline points="9 21 3 21 3 15" />
            <line x1="21" y1="3" x2="14" y2="10" />
            <line x1="3" y1="21" x2="10" y2="14" />
          </svg>
        </button>
      </div>
      <div class="modal-body">
        <div class="item-form">
          <div class="if-row" style="gap: 8px">
            <div class="if-field" style="flex: 1">
              <div class="if-label">Project</div>
              <select v-model="form.projectId" class="if-input if-select">
                <option v-for="p in filteredProjects" :key="p.id" :value="p.id">{{ p.name }}</option>
              </select>
            </div>
            <div class="if-field" style="flex: 1">
              <div class="if-label">Release</div>
              <select v-model="form.releaseId" class="if-input if-select">
                <option value="">(no release)</option>
                <option v-for="r in releasesForProject" :key="r.id" :value="r.id">{{ r.name }}</option>
              </select>
            </div>
          </div>
          <div class="if-field">
              <div class="if-label">Title <span class="required-asterisk">*</span></div>
            <input ref="titleInputRef" v-model="form.title" class="if-input" type="text" placeholder="What needs to be done?" required @keydown.shift.enter.exact.prevent="create" @keydown.ctrl.shift.enter.prevent="saveAndNew" @keydown.esc="emit('close')" />
          </div>
          <div class="if-field">
            <div class="if-label">Analysis</div>
            <textarea v-model="form.analysis" class="if-input if-textarea" rows="6" placeholder="Notes, analysis, context…"></textarea>
          </div>
          <div class="if-field">
            <div class="if-label-inline">
              <span class="if-label">Priority</span>
              <PriorityRadios v-model="form.priority" />
            </div>
          </div>
          <div class="if-field">
            <div class="if-label-inline">
              <span class="if-label">Type</span>
              <TypeRadios v-model="form.type" />
            </div>
          </div>
          <div class="if-field">
            <div class="if-label">Tags (comma-separated)</div>
            <TagInput v-model="form.tagsText" :project-id="form.projectId" />
          </div>
          <div class="if-field">
            <div class="if-label">Prompt</div>
            <textarea v-model="form.prompt" class="if-input if-textarea" rows="3" placeholder="AI prompt / instructions…"></textarea>
          </div>
          <div class="if-field">
            <div class="if-label">Files affected (comma-separated)</div>
            <input v-model="form.filesText" class="if-input" type="text" placeholder="e.g. src/main.ts, src/utils.ts" />
          </div>
          <div class="if-field">
            <div class="if-label">
              Subitems
              <span style="font-weight: 400; color: var(--text-muted); font-size: 10px">(check to mark done, click × to delete)</span>
            </div>
            <SubitemsEditor v-model="form.subitems" />
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="modal-btn modal-btn-cancel" @click="emit('close')">Cancel</button>
        <button class="modal-btn modal-btn-primary" :disabled="!form.title.trim()" @click="saveAndNew">Create &amp; New</button>
        <button class="modal-btn modal-btn-primary" :disabled="!form.title.trim()" @click="create">Create</button>
      </div>
    </div>
  </div>
</template>
