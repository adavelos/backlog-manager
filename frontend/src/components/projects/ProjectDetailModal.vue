<script setup>
import { reactive, watch } from 'vue'

const props = defineProps({ project: { type: Object, default: null } })
const emit = defineEmits(['close', 'save', 'delete'])

const form = reactive({ name: '', description: '', repoPath: '' })

watch(
  () => props.project,
  (project) => {
    if (!project) return
    form.name = project.name || ''
    form.description = project.description || ''
    form.repoPath = project.repoPath || ''
  },
  { immediate: true },
)

function save() {
  emit('save', {
    name: form.name.trim() || props.project.name,
    description: form.description.trim(),
    repoPath: form.repoPath.trim(),
  })
}
</script>

<template>
  <div v-if="project" class="modal-overlay" @click.self="emit('close')">
    <div class="modal-dialog">
      <div class="modal-header">Edit project</div>
      <div class="modal-body">
        <div class="item-detail-form">
          <div class="item-detail-id">{{ project.id }}</div>
          <div class="if-field">
            <div class="if-label">Name</div>
            <input v-model="form.name" class="if-input" type="text" />
          </div>
          <div class="if-field">
            <div class="if-label">Description</div>
            <textarea v-model="form.description" class="if-input if-textarea" rows="3"></textarea>
          </div>
          <div class="if-field">
            <div class="if-label">Repo path</div>
            <input v-model="form.repoPath" class="if-input" type="text" placeholder="e.g. my-org/my-repo" />
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="modal-btn modal-btn-cancel" @click="emit('close')">Cancel</button>
        <button class="modal-btn modal-btn-danger" @click="emit('delete', project)">Delete</button>
        <button class="modal-btn modal-btn-primary" @click="save">Save</button>
      </div>
    </div>
  </div>
</template>
