<script setup>
defineProps({ modelValue: { type: String, default: null } })
const emit = defineEmits(['update:modelValue'])

const options = [
  { v: 'FEATURE', l: 'Feature', c: 'opt-feat' },
  { v: 'BUG', l: 'Bug', c: 'opt-bug' },
]
</script>

<template>
  <div class="if-opts">
    <label v-for="o in options" :key="o.v" class="fp-opt" :class="o.c">
      <input
        type="radio"
        name="type"
        :value="o.v"
        :checked="modelValue === o.v"
        @change="emit('update:modelValue', o.v)"
      />
      <span>{{ o.l }}</span>
    </label>
  </div>
</template>
