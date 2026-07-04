import { computed, reactive } from 'vue'

import { getBacklog, getConfig } from '@/services/backlog.service'
import { showToast } from '@/composables/useToast'

const state = reactive({
  projects: [],
  items: [],
  notes: [],
  scratchpads: {
    work: { content: '', createdAt: 0, updatedAt: 0 },
    argonath: { content: '', createdAt: 0, updatedAt: 0 },
  },
  config: { dataDir: '', dataFile: '' },
  activeProjectType: 'work', // "work" | "argonath"
  currentProjectId: 'ALL',
  activeTags: new Set(),
  loaded: false,
})

async function loadAll() {
  const [config, backlog] = await Promise.all([getConfig(), getBacklog()])
  state.config = config
  state.projects = backlog.projects
  state.items = backlog.items
  state.notes = backlog.notes
  state.scratchpads = backlog.scratchpads
  state.loaded = true
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}

function isArchivedDone(item) {
  if (item.state !== 'DONE' || !item.completedAt) return false
  const ageDays = Math.floor((Date.now() - item.completedAt) / (24 * 3600 * 1000))
  return ageDays > 7
}

function matchesActiveFilters(item) {
  if (state.currentProjectId !== 'ALL' && item.projectId !== state.currentProjectId) return false
  const project = state.projects.find((p) => p.id === item.projectId)
  if (!project || project.type !== state.activeProjectType) return false
  if (state.activeTags.size > 0) {
    const tagsSet = new Set(item.tags || [])
    for (const t of state.activeTags) {
      if (!tagsSet.has(t)) return false
    }
  }
  return true
}

const visibleBoardItems = computed(() =>
  state.items.filter((item) => matchesActiveFilters(item) && !isArchivedDone(item)),
)

const archivedItems = computed(() =>
  state.items.filter((item) => isArchivedDone(item) && matchesActiveFilters(item)),
)

function buildItemPrompt(item) {
  let result = `# ${item.title}`
  if (item.analysis && item.analysis.trim()) {
    result += `\n\n## Analysis\n${item.analysis}`
  }
  if (item.filesAffected && item.filesAffected.length > 0) {
    result += `\n\n## Files Affected\n${item.filesAffected.map((f) => `- ${f}`).join('\n')}`
  }
  if (item.prompt && item.prompt.trim()) {
    result += `\n\n## Prompt\n${item.prompt}`
  }
  return result
}

// Wraps a scoped service call. Callers apply their optimistic local mutation
// *before* invoking this; on failure we pull the authoritative state back
// from the server so a dropped request can't leave the local copy silently
// diverged from disk.
async function syncMutation(promiseFn, { errorMessage } = {}) {
  try {
    return await promiseFn()
  } catch (e) {
    console.error(errorMessage || 'Save failed', e)
    showToast(errorMessage || 'Save failed — reloading latest data')
    await loadAll()
    throw e
  }
}

function toggleProjectType() {
  state.activeProjectType = state.activeProjectType === 'argonath' ? 'work' : 'argonath'
}

export function useBacklogStore() {
  return {
    state,
    loadAll,
    syncMutation,
    toggleProjectType,
    generateId,
    isArchivedDone,
    matchesActiveFilters,
    visibleBoardItems,
    archivedItems,
    buildItemPrompt,
  }
}
