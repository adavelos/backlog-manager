<script setup>
import { computed, ref } from 'vue'

import ItemCard from './ItemCard.vue'

const props = defineProps({
  label: { type: String, required: true },
  items: { type: Array, required: true },
  showAddButton: { type: Boolean, default: false },
})
const emit = defineEmits(['drop', 'drop-reorder', 'add', 'open'])

const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']

const sortedItems = computed(() =>
  props.items.slice().sort((a, b) => {
    const pA = PRIORITIES.indexOf(a.priority)
    const pB = PRIORITIES.indexOf(b.priority)
    if (pA !== pB) return pB - pA
    return (b.updatedAt || 0) - (a.updatedAt || 0)
  }),
)

const dragOver = ref(false)

function onDragOver(e) {
  e.preventDefault()
  e.dataTransfer.dropEffect = 'move'
  dragOver.value = true
}

function onDrop(e) {
  e.preventDefault()
  dragOver.value = false
  const draggedItemId = e.dataTransfer.getData('text/plain')
  if (!draggedItemId) return

  // Check if dropped on an item card (for reordering within column)
  const targetCard = e.target.closest('.item')
  const targetItemId = targetCard?.dataset.itemId

  const draggedIsInColumn = props.items.some(i => i.id === draggedItemId)
  const targetIsInColumn = targetItemId && props.items.some(i => i.id === targetItemId)

  if (draggedIsInColumn && targetIsInColumn && targetItemId !== draggedItemId) {
    // Reordering within the same column
    emit('drop-reorder', { draggedItemId, targetItemId, sortedItems: sortedItems.value })
  } else if (draggedIsInColumn) {
    // Dropped on empty space in the same column or on self - no op
    return
  } else {
    // Moving to a different column
    emit('drop', draggedItemId)
  }
}
</script>

<template>
  <div class="column">
    <div class="column-header">
      <span>{{ label }}</span>
      <span style="display: flex; align-items: center; gap: 6px">
        <span class="count">{{ items.length ? `${items.length} items` : '' }}</span>
        <button
          v-if="showAddButton"
          class="column-add-btn"
          :title="`Add item to ${label}`"
          @click.stop="emit('add')"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      </span>
    </div>
    <div
      class="column-dropzone"
      :class="{ 'qe-drag-over': dragOver }"
      @dragover="onDragOver"
      @dragleave="dragOver = false"
      @drop="onDrop"
    >
      <ItemCard v-for="item in sortedItems" :key="item.id" :item="item" @open="emit('open', $event)" />
    </div>
  </div>
</template>
