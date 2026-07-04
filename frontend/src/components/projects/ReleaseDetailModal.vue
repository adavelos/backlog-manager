<script setup>
import { reactive, watch } from 'vue'

const props = defineProps({ release: { type: Object, default: null } })
const emit = defineEmits(['close', 'save', 'delete'])

const form = reactive({ name: '', state: 'PLANNED', description: '' })

watch(
  () => props.release,
  (release) => {
    if (!release) return
    form.name = release.name || ''
    form.state = release.state || 'PLANNED'
    form.description = release.description || ''
  },
  { immediate: true },
)

function save() {
  emit('save', {
    name: form.name.trim() || props.release.name,
    state: form.state,
    description: form.description.trim(),
  })
}
</script>

<template>
  <div v-if="release" class="modal-overlay" @click.self="emit('close')">
    <div class="modal-dialog">
      <div class="modal-header">Edit release</div>
      <div class="modal-body">
        <div class="item-detail-form">
          <div class="item-detail-id">{{ release.id }}</div>
          <div class="if-row" style="gap: 8px">
            <div class="if-field" style="flex: 1">
              <div class="if-label">Name</div>
              <input v-model="form.name" class="if-input" type="text" />
            </div>
            <div class="if-field" style="flex: 0.6">
              <div class="if-label">State</div>
              <select v-model="form.state" class="if-input if-select">
                <option v-for="s in ['PLANNED', 'ACTIVE', 'ARCHIVED']" :key="s" :value="s">{{ s }}</option>
              </select>
            </div>
          </div>
          <div class="if-field">
            <div class="if-label">Description</div>
            <textarea v-model="form.description" class="if-input if-textarea" rows="3"></textarea>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="modal-btn modal-btn-cancel" @click="emit('close')">Cancel</button>
        <button class="modal-btn modal-btn-danger" @click="emit('delete', release)">Delete</button>
        <button class="modal-btn modal-btn-primary" @click="save">Save</button>
      </div>
    </div>
  </div>
</template>
