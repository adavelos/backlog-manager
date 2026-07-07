<script setup>
import { nextTick, reactive, ref, watch } from 'vue'

import { useBacklogStore } from '@/composables/useBacklogStore'

const { state } = useBacklogStore()

const props = defineProps({ open: { type: Boolean, default: false } })
const emit = defineEmits(['close', 'create'])

const nameInputRef = ref(null)
const keyInputRef = ref(null)

const form = reactive({ name: '', key: '', description: '' })
const keyAutoFilled = ref(true)
const keyError = ref('')

function deriveKey(name) {
  const first = (name.trim().split(/\s+/)[0] || '').toUpperCase()
  return first.slice(0, 3)
}

watch(
  () => form.name,
  (name) => {
    if (keyAutoFilled.value) {
      form.key = deriveKey(name)
      keyError.value = ''
    }
  },
)

function onKeyFocus() {
  keyAutoFilled.value = false
}

function onKeyInput() {
  keyError.value = ''
}

watch(
  () => props.open,
  (open) => {
    if (open) {
      form.name = ''
      form.key = ''
      form.description = ''
      keyAutoFilled.value = true
      keyError.value = ''
      nextTick(() => nameInputRef.value?.focus())
    }
  },
)

function create() {
  const name = form.name.trim()
  if (!name) return
  const key = form.key.trim().toUpperCase()
  if (!key) return

  keyError.value = ''
  const existing = state.projects.find((p) => p.key === key)
  if (existing) {
    keyError.value = `Project key '${key}' is already in use by "${existing.name}"`
    keyInputRef.value?.focus()
    return
  }

  emit('create', { name, description: form.description.trim(), key })
}
</script>

<template>
  <div v-if="open" class="modal-overlay" @click.self="emit('close')">
    <div class="modal-dialog">
      <div class="modal-header">New project</div>
      <div class="modal-body">
        <div class="item-form">
          <div class="if-row" style="gap: 8px">
            <div class="if-field" style="flex: 1">
              <div class="if-label">Name <span class="required-asterisk">*</span></div>
              <input ref="nameInputRef" v-model="form.name" class="if-input" type="text" placeholder="Project name" @keydown.enter="create" />
            </div>
            <div class="if-field" style="flex: 0 0 80px">
              <div class="if-label">Key <span class="required-asterisk">*</span></div>
              <input
                ref="keyInputRef"
                v-model="form.key"
                class="if-input"
                :class="{ 'input-error': keyError }"
                type="text"
                maxlength="3"
                placeholder="XXX"
                style="text-transform: uppercase; text-align: center;"
                @focus="onKeyFocus"
                @input="onKeyInput"
                @keydown.enter="create"
              />
              <span v-if="keyError" class="field-error">{{ keyError }}</span>
            </div>
          </div>
          <div class="if-field">
            <div class="if-label">Description</div>
            <textarea v-model="form.description" class="if-input if-textarea" rows="2" placeholder="Optional description…"></textarea>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="modal-btn modal-btn-cancel" @click="emit('close')">Cancel</button>
        <button class="modal-btn modal-btn-primary" :disabled="!form.name.trim() || !form.key.trim()" @click="create">Create</button>
      </div>
    </div>
  </div>
</template>
