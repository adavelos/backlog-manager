<script setup>
import { computed } from 'vue'

import { useBacklogStore } from '@/composables/useBacklogStore'
import { showToast } from '@/composables/useToast'

const props = defineProps({
  item: { type: Object, required: true },
  states: { type: Array, required: true },
})
const emit = defineEmits(['move', 'close'])

const { buildItemPrompt } = useBacklogStore()

const currentLabel = computed(() => props.states.find((s) => s.id === props.item.state)?.label || props.item.state)
const targets = computed(() => props.states.filter((s) => s.id !== props.item.state))

async function copyPrompt() {
  try {
    await navigator.clipboard.writeText(buildItemPrompt(props.item))
    showToast('Prompt copied to clipboard')
  } catch {
    showToast('Failed to copy prompt')
  }
}
</script>

<template>
  <div class="m-sheet-overlay" @click.self="emit('close')">
    <div class="m-sheet" role="dialog" aria-modal="true" :aria-label="item.title">
      <div class="m-sheet-grip" aria-hidden="true"></div>

      <div class="m-sheet-head">
        <span v-if="item.ticketId" class="item-ticket">{{ item.ticketId }}</span>
        <h2 class="m-sheet-title">{{ item.title }}</h2>
      </div>

      <div class="m-card-meta">
        <span class="badge">{{ currentLabel }}</span>
        <span v-if="item.priority" class="badge" :class="`priority-${item.priority}`">{{ item.priority }}</span>
      </div>

      <p class="m-sheet-label">Move to</p>
      <div class="m-sheet-moves">
        <button v-for="t in targets" :key="t.id" class="m-move-btn" @click="emit('move', t.id)">
          {{ t.label }}
        </button>
      </div>

      <button class="m-sheet-action" @click="copyPrompt">Copy AI prompt</button>
      <button class="m-sheet-cancel" @click="emit('close')">Close</button>
    </div>
  </div>
</template>
