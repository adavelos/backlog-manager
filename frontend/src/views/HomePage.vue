<script setup>
import { onMounted } from 'vue'
import { useBacklogStore } from '@/composables/useBacklogStore'

const { loadAll } = useBacklogStore()

onMounted(() => {
  loadAll()
})
</script>

<template>
  <div class="layout" style="display: flex; align-items: center; justify-content: center; gap: 24px; padding: 40px">
    <router-link to="/boards" style="text-decoration: none">
      <div class="home-card">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--indigo-600)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom: 12px">
          <rect x="3" y="3" width="7" height="9" /><rect x="14" y="3" width="7" height="5" />
          <rect x="14" y="12" width="7" height="9" /><rect x="3" y="16" width="7" height="5" />
        </svg>
        <div class="home-card-title">Boards</div>
        <div class="home-card-desc">State &amp; release boards, quick edit, archive</div>
      </div>
    </router-link>
    <router-link to="/projects" style="text-decoration: none">
      <div class="home-card">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--emerald-600)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom: 12px">
          <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
          <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
        </svg>
        <div class="home-card-title">Projects</div>
        <div class="home-card-desc">Projects &amp; releases management</div>
      </div>
    </router-link>
    <router-link to="/notes" style="text-decoration: none">
      <div class="home-card">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--amber-600)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom: 12px">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
        </svg>
        <div class="home-card-title">Notes</div>
        <div class="home-card-desc">Hierarchical notes with Markdown editor</div>
      </div>
    </router-link>
  </div>
</template>

<style scoped>
.home-card {
  background: var(--bg-surface);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-lg);
  padding: 32px 40px;
  text-align: center;
  box-shadow: var(--shadow-sm);
  transition: all 0.2s;
  cursor: pointer;
  min-width: 200px;
}
.home-card-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 4px;
}
.home-card-desc {
  font-size: 12px;
  color: var(--text-muted);
}
</style>
