<script setup>
import { nextTick, reactive, ref, watch } from 'vue'

const props = defineProps({ open: { type: Boolean, default: false } })
const emit = defineEmits(['close', 'create'])

const nameInputRef = ref(null)

const form = reactive({ name: '', description: '' })

watch(
  () => props.open,
  (open) => {
    if (open) {
      form.name = ''
      form.description = ''
      nextTick(() => nameInputRef.value?.focus())
    }
  },
)

function create() {
  const name = form.name.trim()
  if (!name) return
  emit('create', { name, description: form.description.trim() })
}
</script>

<template>
  <div v-if="open" class="modal-overlay" @click.self="emit('close')">
    <div class="modal-dialog">
      <div class="modal-header">New project</div>
      <div class="modal-body">
        <div class="item-form">
          <div class="if-field">
            <div class="if-label">Name</div>
            <input ref="nameInputRef" v-model="form.name" class="if-input" type="text" placeholder="Project name" @keydown.enter="create" />
          </div>
          <div class="if-field">
            <div class="if-label">Description</div>
            <textarea v-model="form.description" class="if-input if-textarea" rows="2" placeholder="Optional description…"></textarea>
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
