<script setup>
import { useBacklogStore } from '@/composables/useBacklogStore'
import { showToast } from '@/composables/useToast'

const props = defineProps({ item: { type: Object, required: true } })
const emit = defineEmits(['open', 'dragstart'])

const { buildItemPrompt } = useBacklogStore()

async function copyPrompt(e) {
  e.stopPropagation()
  const text = buildItemPrompt(props.item)
  try {
    await navigator.clipboard.writeText(text)
    showToast('Prompt copied to clipboard')
  } catch {
    showToast('Failed to copy prompt')
  }
}

function onDragStart(e) {
  e.dataTransfer.setData('text/plain', props.item.id)
  emit('dragstart', props.item)
}
</script>

<template>
  <div class="item" :data-item-id="item.id" draggable="true" @click.stop="emit('open', item.id)" @dragstart="onDragStart">
    <div class="item-title">
      <span class="item-title-text">{{ item.title }}</span>
      <button class="item-prompt-btn" title="Copy AI prompt to clipboard" @click="copyPrompt">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
          <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
        </svg>
      </button>
    </div>
    <div class="item-meta">
      <span class="badge" :class="`priority-${item.priority}`">{{ item.priority }}</span>
      <span v-if="item.type === 'FEATURE' || item.type === 'BUG'" class="badge" :class="`type-${item.type}`">
        {{ item.type === 'FEATURE' ? 'Feature' : 'Bug' }}
      </span>
      <span v-if="item.releaseId" class="badge" style="background: var(--cyan-50); color: var(--cyan-500); border-color: var(--cyan-100)">
        Release
      </span>
    </div>
    <div v-if="item.tags && item.tags.length > 0" class="item-tags">
      <span v-for="t in item.tags.slice(0, 3)" :key="t" class="tag-badge">{{ t }}</span>
      <span v-if="item.tags.length > 3" class="tag-badge">+{{ item.tags.length - 3 }}</span>
    </div>
  </div>
</template>
