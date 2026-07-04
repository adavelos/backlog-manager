<script setup>
import { computed, ref } from 'vue'

import { useBacklogStore } from '@/composables/useBacklogStore'

const props = defineProps({ modelValue: { type: String, default: '' } })
const emit = defineEmits(['update:modelValue'])

const { state } = useBacklogStore()
const showSuggestions = ref(false)

const allTags = computed(() => {
  const tags = new Set()
  state.items.forEach((item) => (item.tags || []).forEach((t) => tags.add(t)))
  return Array.from(tags).sort()
})

const lastSegment = computed(() => {
  const parts = props.modelValue.split(',')
  return parts[parts.length - 1].trim()
})

const suggestions = computed(() => {
  const lower = lastSegment.value.toLowerCase()
  if (!lower) return []
  return allTags.value.filter((t) => t.toLowerCase().includes(lower))
})

function onInput(e) {
  emit('update:modelValue', e.target.value)
  showSuggestions.value = true
}

function onFocus() {
  if (lastSegment.value) showSuggestions.value = true
}

function onBlur() {
  setTimeout(() => (showSuggestions.value = false), 200)
}

function pickSuggestion(tag) {
  const parts = props.modelValue.split(',').map((s) => s.trim())
  if (parts.length > 0 && parts[parts.length - 1] !== '') {
    parts[parts.length - 1] = tag
  } else {
    parts.push(tag)
  }
  emit('update:modelValue', parts.join(', ') + ', ')
  showSuggestions.value = false
}
</script>

<template>
  <div class="tag-input-wrapper">
    <input
      class="if-input"
      type="text"
      autocomplete="off"
      :value="modelValue"
      @input="onInput"
      @focus="onFocus"
      @blur="onBlur"
    />
    <div class="tag-suggestions" :class="{ hidden: !showSuggestions || suggestions.length === 0 }">
      <div
        v-for="tag in suggestions"
        :key="tag"
        class="tag-suggestion-item"
        @mousedown.prevent="pickSuggestion(tag)"
      >
        {{ tag }}
      </div>
    </div>
  </div>
</template>
