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
    // First sort by priority (CRITICAL > HIGH > MEDIUM > LOW)
    const pA = PRIORITIES.indexOf((a.priority || '').toUpperCase())
    const pB = PRIORITIES.indexOf((b.priority || '').toUpperCase())
    if (pA !== pB) return pB - pA
    // Then sort by sortOrder within same priority
    const aSort = a.sortOrder || 0
    const bSort = b.sortOrder || 0
    if (aSort !== bSort) return aSort - bSort
    // Fall back to updatedAt
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

  const draggedItem = props.items.find(i => i.id === draggedItemId)
  const targetItem = targetItemId && props.items.find(i => i.id === targetItemId)

  if (draggedItem && targetItem && targetItemId !== draggedItemId) {
    // Only allow reordering if both items have the same priority
    const draggedPri = (draggedItem.priority || '').toUpperCase()
    const targetPri = (targetItem.priority || '').toUpperCase()
    if (draggedPri === targetPri) {
      emit('drop-reorder', { draggedItemId, targetItemId, sortedItems: sortedItems.value })
    }
    // else: silently ignore drop on different priority (could add visual feedback here)
  } else if (!draggedItem) {
    // Dragged item not in this column - moving to a different column
    const draggedFromOtherColumn = e.dataTransfer.getData('text/plain')
    if (draggedFromOtherColumn) emit('drop', draggedFromOtherColumn)
  }
}

function shouldShowSeparator(index) {
  if (index === 0 || index >= sortedItems.value.length - 1) return false
  const currentPri = (sortedItems.value[index].priority || '').toUpperCase()
  const nextPri = (sortedItems.value[index + 1].priority || '').toUpperCase()
  return currentPri !== nextPri
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
      <template v-for="(item, index) in sortedItems" :key="item.id">
        <ItemCard :item="item" @open="emit('open', $event)" />
        <div v-if="shouldShowSeparator(index)" class="priority-separator" />
      </template>
    </div>
  </div>
</template>
