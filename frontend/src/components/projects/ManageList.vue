<script setup>
import { computed, ref, watch } from 'vue'

const props = defineProps({
  items: { type: Array, required: true }, // must have .id and .sortOrder
  selectedId: { type: String, default: null },
})
const emit = defineEmits(['reorder', 'item-click'])

const listRef = ref(null)
const draggingId = ref(null)
const localOrder = ref(props.items.map((i) => i.id))

watch(
  () => props.items,
  (items) => {
    if (draggingId.value) return
    localOrder.value = items.map((i) => i.id)
  },
)

const orderedItems = computed(() =>
  localOrder.value.map((id) => props.items.find((i) => i.id === id)).filter(Boolean),
)

function startDrag(id, e) {
  draggingId.value = id
  e.dataTransfer.effectAllowed = 'move'
  e.dataTransfer.setData('text/plain', id)
}

function endDrag() {
  draggingId.value = null
}

function getDragAfterElement(container, y) {
  const els = [...container.querySelectorAll('.manage-item')].filter(
    (el) => el.dataset.id !== draggingId.value,
  )
  return els.reduce(
    (closest, child) => {
      const box = child.getBoundingClientRect()
      const offset = y - box.top - box.height / 2
      if (offset < 0 && offset > closest.offset) {
        return { offset, element: child }
      }
      return closest
    },
    { offset: Number.NEGATIVE_INFINITY, element: null },
  ).element
}

function onDragOver(e) {
  e.preventDefault()
  e.dataTransfer.dropEffect = 'move'
  if (!draggingId.value || !listRef.value) return
  const afterEl = getDragAfterElement(listRef.value, e.clientY)
  const afterId = afterEl ? afterEl.dataset.id : null
  const newOrder = localOrder.value.filter((id) => id !== draggingId.value)
  if (afterId) {
    newOrder.splice(newOrder.indexOf(afterId), 0, draggingId.value)
  } else {
    newOrder.push(draggingId.value)
  }
  localOrder.value = newOrder
}

function onDrop(e) {
  e.preventDefault()
  emit('reorder', localOrder.value.slice())
  draggingId.value = null
}
</script>

<template>
  <div ref="listRef" class="manage-list" @dragover="onDragOver" @dragenter.prevent @drop="onDrop">
    <slot v-if="orderedItems.length === 0" name="empty" />
    <div
      v-for="item in orderedItems"
      :key="item.id"
      class="manage-item"
      :class="{ dragging: draggingId === item.id, selected: selectedId === item.id }"
      :data-id="item.id"
      draggable="true"
      @dragstart="startDrag(item.id, $event)"
      @dragend="endDrag"
      @click="emit('item-click', item)"
    >
      <slot :item="item" />
    </div>
  </div>
</template>
