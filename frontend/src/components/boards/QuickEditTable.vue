<script setup>
import QuickEditGroup from './QuickEditGroup.vue'

defineProps({
  groups: { type: Array, required: true }, // [{ id, label, items }]
  showStateColumn: { type: Boolean, default: false },
})
const emit = defineEmits(['edit-title', 'drop-reorder', 'drop-move'])
</script>

<template>
  <div class="qe-container">
    <QuickEditGroup
      v-for="group in groups"
      :key="group.id"
      :group="group"
      :show-state-column="showStateColumn"
      @edit-title="emit('edit-title', $event)"
      @drop-reorder="emit('drop-reorder', $event)"
      @drop-move="emit('drop-move', $event)"
    />
  </div>
</template>
