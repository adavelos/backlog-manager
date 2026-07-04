<script setup>
import { nextTick, ref, watch } from 'vue'

import { useModal } from '@/composables/useModal'

const { state, resolveModal } = useModal()
const inputRef = ref(null)
const inputValue = ref('')

watch(
  () => state.visible,
  (visible) => {
    if (visible) {
      inputValue.value = state.inputValue || ''
      if (state.showInput) {
        nextTick(() => inputRef.value?.focus())
      }
    }
  },
)

function clickButton(btn) {
  if (btn.useInputValue) {
    resolveModal(inputValue.value.trim())
  } else {
    resolveModal(btn.value !== undefined ? btn.value : true)
  }
}

function onOverlayClick(e) {
  if (e.target === e.currentTarget) resolveModal(null)
}

function onKeydown(e) {
  if (e.key === 'Escape') {
    resolveModal(null)
    return
  }
  if (e.key === 'Enter' && !e.shiftKey && e.target.tagName !== 'TEXTAREA') {
    e.preventDefault()
    const focused = state.buttons.find((b) => b.focused)
    if (focused) {
      clickButton(focused)
    } else if (state.showInput && inputValue.value.trim()) {
      resolveModal(inputValue.value.trim())
    }
  }
}
</script>

<template>
  <div
    class="modal-overlay"
    :class="{ hidden: !state.visible }"
    @click="onOverlayClick"
    @keydown="onKeydown"
  >
    <div class="modal-dialog">
      <div class="modal-header">{{ state.title }}</div>
      <div class="modal-body">
        <p v-if="state.message" class="modal-message">{{ state.message }}</p>
        <input
          v-if="state.showInput"
          ref="inputRef"
          v-model="inputValue"
          class="modal-input"
          type="text"
          :placeholder="state.inputPlaceholder"
        />
      </div>
      <div class="modal-footer">
        <button
          v-for="(btn, idx) in state.buttons"
          :key="idx"
          class="modal-btn"
          :class="btn.className || 'modal-btn-primary'"
          @click="clickButton(btn)"
        >
          {{ btn.label }}
        </button>
      </div>
    </div>
  </div>
</template>
