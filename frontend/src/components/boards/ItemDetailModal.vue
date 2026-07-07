<script setup>
import { onMounted, onUnmounted, reactive, ref, watch } from 'vue'

import PriorityRadios from './PriorityRadios.vue'
import TypeRadios from './TypeRadios.vue'
import TagInput from './TagInput.vue'
import SubitemsEditor from './SubitemsEditor.vue'
import { useBacklogStore } from '@/composables/useBacklogStore'
import { showToast } from '@/composables/useToast'

const props = defineProps({ item: { type: Object, default: null } })
const emit = defineEmits(['close', 'save', 'delete'])

const { buildItemPrompt, state } = useBacklogStore()

const form = reactive({
  title: '',
  state: 'BACKLOG',
  releaseId: '',
  priority: 'MEDIUM',
  type: 'FEATURE',
  tagsText: '',
  analysis: '',
  prompt: '',
  report: '',
  filesText: '',
  subitems: [],
})

const titleInputRef = ref(null)

function onKeydown(e) {
  if (e.key === 'Escape') emit('close')
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))

watch(
  () => props.item,
  (item) => {
    if (!item) return
    form.title = item.title
    form.state = item.state
    form.releaseId = item.releaseId || ''
    form.priority = item.priority
    form.type = item.type
    form.tagsText = (item.tags || []).join(', ')
    form.analysis = item.analysis || ''
    form.prompt = item.prompt || ''
    form.report = item.report || ''
    form.filesText = (item.filesAffected || []).join(', ')
    form.subitems = (item.subitems || []).map((s) => ({ ...s }))
  },
  { immediate: true },
)

const project = () => state.projects.find((p) => p.id === props.item?.projectId)
const releases = () =>
  (project()?.releases || []).slice().sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))

function splitList(text) {
  return text
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

async function copyPrompt() {
  const text = buildItemPrompt(props.item)
  try {
    await navigator.clipboard.writeText(text)
    showToast('Prompt copied to clipboard')
  } catch {
    showToast('Failed to copy prompt')
  }
}

function save() {
  const title = form.title.trim()
  if (!title) return
  emit('save', {
    title,
    state: form.state,
    releaseId: form.releaseId || null,
    priority: form.priority,
    type: form.type,
    tags: splitList(form.tagsText),
    analysis: form.analysis.trim(),
    prompt: form.prompt.trim(),
    report: form.report.trim(),
    filesAffected: splitList(form.filesText),
    subitems: form.subitems,
  })
}
</script>

<template>
  <div v-if="item" class="modal-overlay" @click.self="emit('close')">
    <div class="modal-dialog">
      <div class="modal-header">
        <span>Edit item</span>
        <button class="modal-prompt-btn" title="Copy AI prompt to clipboard" @click="copyPrompt">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
            <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
          </svg>
        </button>
      </div>
      <div class="modal-body">
        <div class="item-detail-form">
          <div class="item-detail-id">{{ item.id }}</div>

          <div class="if-row if-project" style="gap: 8px; align-items: center">
            <span style="font-size: 11px; font-weight: 600; color: var(--text-muted)">{{ project()?.name || '—' }}</span>
          </div>

          <div class="if-row" style="gap: 8px">
            <div class="if-field" style="flex: 1">
              <div class="if-label">State</div>
              <select v-model="form.state" class="if-input if-select">
                <option v-for="s in ['BACKLOG', 'TODO', 'ONGOING', 'DONE']" :key="s" :value="s">{{ s }}</option>
              </select>
            </div>
            <div class="if-field" style="flex: 1">
              <div class="if-label">Release</div>
              <select v-model="form.releaseId" class="if-input if-select">
                <option value="">(no release)</option>
                <option v-for="r in releases()" :key="r.id" :value="r.id">{{ r.name }}</option>
              </select>
            </div>
          </div>

          <div class="if-field">
              <div class="if-label">Title <span class="required-asterisk">*</span></div>
            <input ref="titleInputRef" v-model="form.title" class="if-input" type="text" required @keydown.shift.enter.exact.prevent="save" />
          </div>

          <div class="if-field">
            <div class="if-label">Analysis</div>
            <textarea v-model="form.analysis" class="if-input if-textarea" rows="3"></textarea>
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
            <TagInput v-model="form.tagsText" :project-id="props.item?.projectId" />
          </div>

          <div class="if-field">
            <div class="if-label">Prompt</div>
            <textarea v-model="form.prompt" class="if-input if-textarea" rows="3"></textarea>
          </div>

          <div class="if-field">
            <div class="if-label">Report</div>
            <textarea v-model="form.report" class="if-input if-textarea" rows="3"></textarea>
          </div>

          <div class="if-field">
            <div class="if-label">Files affected (comma-separated)</div>
            <input v-model="form.filesText" class="if-input" type="text" />
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
        <button class="modal-btn modal-btn-danger" @click="emit('delete', item)">Delete</button>
        <button class="modal-btn modal-btn-primary" :disabled="!form.title.trim()" @click="save">Save</button>
      </div>
    </div>
  </div>
</template>
