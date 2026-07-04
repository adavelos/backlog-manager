<script setup>
import { computed, reactive, watch } from 'vue'

import PriorityRadios from './PriorityRadios.vue'
import TypeRadios from './TypeRadios.vue'
import TagInput from './TagInput.vue'
import { useBacklogStore } from '@/composables/useBacklogStore'

const props = defineProps({
  targetState: { type: String, default: null },
  defaultProjectId: { type: String, default: null },
})
const emit = defineEmits(['close', 'create'])

const { state } = useBacklogStore()

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
    const activeRelease = releasesForProject.value.find((r) => r.state === 'ACTIVE')
    if (activeRelease) form.releaseId = activeRelease.id
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

function create() {
  const title = form.title.trim()
  if (!title) return
  emit('create', {
    projectId: form.projectId,
    releaseId: form.releaseId || null,
    title,
    priority: form.priority,
    type: form.type,
    tags: splitList(form.tagsText),
    analysis: form.analysis.trim(),
    prompt: form.prompt.trim(),
    filesAffected: splitList(form.filesText),
  })
}
</script>

<template>
  <div v-if="targetState" class="modal-overlay" @click.self="emit('close')">
    <div class="modal-dialog">
      <div class="modal-header">New {{ targetState }} item</div>
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
            <div class="if-label">Title</div>
            <input v-model="form.title" class="if-input" type="text" placeholder="What needs to be done?" @keydown.enter="create" />
          </div>
          <div class="if-field">
            <div class="if-label">Analysis</div>
            <textarea v-model="form.analysis" class="if-input if-textarea" rows="3" placeholder="Notes, analysis, context…"></textarea>
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
            <TagInput v-model="form.tagsText" />
          </div>
          <div class="if-field">
            <div class="if-label">Prompt</div>
            <textarea v-model="form.prompt" class="if-input if-textarea" rows="3" placeholder="AI prompt / instructions…"></textarea>
          </div>
          <div class="if-field">
            <div class="if-label">Files affected (comma-separated)</div>
            <input v-model="form.filesText" class="if-input" type="text" placeholder="e.g. src/main.ts, src/utils.ts" />
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="modal-btn modal-btn-cancel" @click="emit('close')">Cancel</button>
        <button class="modal-btn modal-btn-primary" @click="create">Create</button>
      </div>
    </div>
  </div>
</template>
