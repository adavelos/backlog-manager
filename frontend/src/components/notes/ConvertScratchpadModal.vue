<script setup>
import { reactive, watch } from 'vue'

import { useBacklogStore } from '@/composables/useBacklogStore'

const props = defineProps({ open: { type: Boolean, default: false } })
const emit = defineEmits(['close', 'convert'])

const { state } = useBacklogStore()

const form = reactive({ projectId: '', title: '', keepScratchpad: true })

const scopeProjects = () => state.projects.filter((p) => p.type === state.activeProjectType)

watch(
  () => props.open,
  (open) => {
    if (!open) return
    form.projectId = scopeProjects()[0]?.id || ''
    form.title = ''
    form.keepScratchpad = true
  },
)

function convert() {
  emit('convert', {
    projectId: form.projectId,
    title: form.title.trim() || 'Untitled note',
    keepScratchpad: form.keepScratchpad,
  })
}
</script>

<template>
  <div v-if="open" class="modal-overlay" @click.self="emit('close')">
    <div class="modal-dialog">
      <div class="modal-header">Convert scratchpad to note</div>
      <div class="modal-body">
        <div style="display: flex; flex-direction: column; gap: 12px">
          <div>
            <label style="display: block; font-size: 12px; font-weight: 600; margin-bottom: 4px; color: var(--text-secondary)">Project</label>
            <select
              v-model="form.projectId"
              style="width: 100%; padding: 6px 8px; border: 1px solid var(--border-light); border-radius: var(--radius-sm); font-family: var(--font); font-size: 13px; background: var(--bg-muted); color: var(--text-primary)"
            >
              <option v-for="p in scopeProjects()" :key="p.id" :value="p.id">{{ p.name }}</option>
            </select>
          </div>
          <div>
            <label style="display: block; font-size: 12px; font-weight: 600; margin-bottom: 4px; color: var(--text-secondary)">Note title</label>
            <input
              v-model="form.title"
              type="text"
              placeholder="e.g., My captured note"
              style="width: 100%; padding: 6px 8px; border: 1px solid var(--border-light); border-radius: var(--radius-sm); font-family: var(--font); font-size: 13px; background: var(--bg-muted); color: var(--text-primary)"
            />
          </div>
          <div style="display: flex; gap: 6px">
            <label style="display: flex; align-items: center; gap: 4px; font-size: 12px; color: var(--text-secondary)">
              <input v-model="form.keepScratchpad" type="checkbox" />
              Keep scratchpad after conversion
            </label>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="modal-btn modal-btn-cancel" @click="emit('close')">Cancel</button>
        <button class="modal-btn modal-btn-primary" @click="convert">Convert</button>
      </div>
    </div>
  </div>
</template>
