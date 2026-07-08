<script setup>
defineProps({ modelValue: { type: String, default: null } })
const emit = defineEmits(['update:modelValue'])

const options = [
  { v: 'LOW', l: 'Low', c: 'opt-low' },
  { v: 'MEDIUM', l: 'Medium', c: 'opt-medium' },
  { v: 'HIGH', l: 'High', c: 'opt-high' },
  { v: 'CRITICAL', l: 'Critical', c: 'opt-critical' },
  { v: 'BLOCKER', l: 'Blocker', c: 'opt-blocker' },
]
</script>

<template>
  <div class="if-opts">
    <label v-for="o in options" :key="o.v" class="fp-opt" :class="o.c">
      <input
        type="radio"
        name="priority"
        :value="o.v"
        :checked="modelValue === o.v"
        @change="emit('update:modelValue', o.v)"
      />
      <span>{{ o.l }}</span>
    </label>
  </div>
</template>
