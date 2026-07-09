<script setup>
import { ref } from 'vue'

import { useBacklogStore } from '@/composables/useBacklogStore'

const props = defineProps({ modelValue: { type: Array, default: () => [] } })
const emit = defineEmits(['update:modelValue'])

const { generateId } = useBacklogStore()
const newTitle = ref('')
const draggedIdx = ref(null)
const dragOverIdx = ref(null)

function toggleDone(idx) {
  const next = props.modelValue.slice()
  next[idx] = { ...next[idx], done: !next[idx].done }
  emit('update:modelValue', next)
}

function remove(idx) {
  emit(
    'update:modelValue',
    props.modelValue.filter((_, i) => i !== idx),
  )
}

function add() {
  const title = newTitle.value.trim()
  if (!title) return
  emit('update:modelValue', [...props.modelValue, { id: 'si-' + generateId(), title, done: false }])
  newTitle.value = ''
}

function onDragStart(e, idx) {
  draggedIdx.value = idx
  e.dataTransfer.effectAllowed = 'move'
  e.dataTransfer.setData('text/plain', String(idx))
}

function onDragOver(e, idx) {
  e.preventDefault()
  dragOverIdx.value = idx
  e.dataTransfer.dropEffect = 'move'
}

function onDragLeave() {
  dragOverIdx.value = null
}

function onDrop(e, targetIdx) {
  e.preventDefault()
  dragOverIdx.value = null
  const sourceIdx = Number(e.dataTransfer.getData('text/plain'))
  if (sourceIdx !== targetIdx && sourceIdx >= 0 && sourceIdx < props.modelValue.length) {
    const next = props.modelValue.slice()
    const [item] = next.splice(sourceIdx, 1)
    next.splice(targetIdx, 0, item)
    emit('update:modelValue', next)
  }
}

function onDragEnd() {
  draggedIdx.value = null
  dragOverIdx.value = null
}
</script>

<template>
  <div>
    <div id="idSubitems">
      <div
        v-for="(si, idx) in modelValue"
        :key="si.id || idx"
        class="subitem-row"
        :class="{ done: si.done, dragging: draggedIdx === idx, 'drag-over': dragOverIdx === idx }"
        draggable="true"
        @dragstart="onDragStart($event, idx)"
        @dragover="onDragOver($event, idx)"
        @dragleave="onDragLeave"
        @drop="onDrop($event, idx)"
        @dragend="onDragEnd"
      >
        <span class="subitem-handle" title="Drag to reorder">⋮</span>
        <input type="checkbox" class="si-check" :checked="si.done" @change="toggleDone(idx)" />
        <span class="subitem-title">{{ si.title }}</span>
        <button class="manage-item-action danger si-del" style="opacity: 0.3" @click="remove(idx)">&times;</button>
      </div>
    </div>
    <div class="subitem-add-row">
      <input
        v-model="newTitle"
        class="if-input"
        type="text"
        placeholder="Add subitem…"
        @keydown.enter.prevent="add"
      />
      <button class="add-subitem-btn" title="Add subitem" @click="add">+</button>
    </div>
  </div>
</template>
