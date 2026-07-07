<script setup>
import { nextTick, ref } from 'vue'

const props = defineProps({
  group: { type: Object, required: true }, // { id, label, items }
  showStateColumn: { type: Boolean, default: false },
})
const emit = defineEmits(['edit-title', 'drop-reorder', 'drop-move'])

const editingItemId = ref(null)
const editingValue = ref('')
const draggingItemId = ref(null)
const dragOver = ref(false)
const inputRefs = ref({})

function columnCount() {
  return props.showStateColumn ? 6 : 5
}

function startEdit(item) {
  editingItemId.value = item.id
  editingValue.value = item.title
  nextTick(() => {
    const el = inputRefs.value[item.id]
    if (el) {
      el.focus()
      el.select()
    }
  })
}

function commitEdit(item) {
  if (editingItemId.value !== item.id) return
  const trimmed = editingValue.value.trim()
  editingItemId.value = null
  if (!trimmed || trimmed === item.title) return
  emit('edit-title', { itemId: item.id, title: trimmed })
}

function cancelEdit() {
  editingItemId.value = null
}

function focusNextRow(item, forward) {
  const idx = props.group.items.findIndex((i) => i.id === item.id)
  if (idx < 0) return
  const nextIdx = forward ? idx + 1 : idx - 1
  const nextItem = props.group.items[nextIdx]
  if (nextItem) startEdit(nextItem)
}

function onKeydown(e, item) {
  if (e.key === 'Enter') {
    commitEdit(item)
    e.preventDefault()
  } else if (e.key === 'Escape') {
    cancelEdit()
    e.preventDefault()
  } else if (e.key === 'Tab') {
    commitEdit(item)
    e.preventDefault()
    focusNextRow(item, !e.shiftKey)
  }
}

function onDragStart(e, item) {
  if (editingItemId.value === item.id) {
    e.preventDefault()
    return
  }
  draggingItemId.value = item.id
  e.dataTransfer.effectAllowed = 'move'
  e.dataTransfer.setData('text/plain', item.id)
}

function onDrop(e) {
  e.preventDefault()
  dragOver.value = false
  const draggedItemId = e.dataTransfer.getData('text/plain')
  if (!draggedItemId) return
  const targetTr = e.target.closest('tr')
  const targetItemId = targetTr?.dataset.itemId

  if (targetItemId && targetItemId !== draggedItemId) {
    const draggedItem = props.group.items.find(i => i.id === draggedItemId)
    const targetItem = props.group.items.find(i => i.id === targetItemId)
    // Only allow reordering if both items have the same priority
    if (draggedItem && targetItem) {
      const draggedPri = (draggedItem.priority || '').toUpperCase()
      const targetPri = (targetItem.priority || '').toUpperCase()
      if (draggedPri === targetPri) {
        emit('drop-reorder', { draggedItemId, targetItemId, groupId: props.group.id })
      }
    }
  } else if (!targetItemId) {
    emit('drop-move', { draggedItemId, groupId: props.group.id })
  }
}
</script>

<template>
  <div class="qe-group" :data-group-id="group.id">
    <div class="qe-group-label">{{ group.label }} ({{ group.items.length }})</div>
    <table class="qe-table">
      <thead>
        <tr>
          <th>#</th>
          <th>Title</th>
          <th>Priority</th>
          <th>Type</th>
          <th v-if="showStateColumn">State</th>
          <th>Tags</th>
        </tr>
      </thead>
      <tbody
        class="qe-tbody"
        :class="{ 'qe-drag-over': dragOver }"
        @dragover.prevent="dragOver = true"
        @dragleave="dragOver = false"
        @drop="onDrop"
      >
        <tr v-if="group.items.length === 0" class="qe-empty-row">
          <td :colspan="columnCount()" style="text-align: center; color: var(--text-muted); font-style: italic; padding: 12px 6px">
            — drop items here —
          </td>
        </tr>
        <tr
          v-for="(item, rowIndex) in group.items"
          :key="item.id"
          :data-item-id="item.id"
          :draggable="editingItemId !== item.id"
          :class="{ 'qe-row-dragging': draggingItemId === item.id }"
          @dragstart="onDragStart($event, item)"
          @dragend="draggingItemId = null"
        >
          <td style="width: 5%"><span class="qe-row-handle">{{ item.ticketId || item.ticketNumber || rowIndex + 1 }}</span></td>
          <td
            style="width: 40%"
            class="qe-cell-editable"
            :title="item.title"
            @dblclick="startEdit(item)"
          >
            <input
              v-if="editingItemId === item.id"
              :ref="(el) => (inputRefs[item.id] = el)"
              v-model="editingValue"
              class="qe-cell-input"
              type="text"
              autocomplete="off"
              @mousedown.stop
              @dragstart.prevent.stop
              @keydown="onKeydown($event, item)"
              @blur="commitEdit(item)"
            />
            <template v-else>{{ item.title }}</template>
          </td>
          <td style="width: 10%"><span class="qe-badge badge" :class="`priority-${item.priority}`">{{ item.priority }}</span></td>
          <td style="width: 10%"><span class="qe-badge badge" :class="`type-${item.type}`">{{ item.type }}</span></td>
          <td v-if="showStateColumn" style="width: 10%"><span class="qe-badge badge">{{ item.state }}</span></td>
          <td :style="{ width: showStateColumn ? '25%' : '35%' }" :title="(item.tags || []).join(', ')">
            {{ (item.tags || []).join(', ') }}
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
