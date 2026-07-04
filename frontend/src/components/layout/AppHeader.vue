<script setup>
import { useBacklogStore } from '@/composables/useBacklogStore'

const { state, toggleProjectType } = useBacklogStore()
</script>

<template>
  <header class="app-header">
    <div class="app-brand">
      <div>
        <img src="/img/icon.svg" alt="Backlog Manager" width="22" height="22" />
      </div>
      <div class="app-title">Backlog Manager</div>
    </div>
    <div class="app-main-nav">
      <router-link to="/boards" class="nav-pill" active-class="active">Boards</router-link>
      <router-link to="/projects" class="nav-pill" active-class="active">Projects</router-link>
      <router-link to="/notes" class="nav-pill" active-class="active">Notes</router-link>
    </div>
    <div class="header-type-toggle" @click="toggleProjectType">
      <span class="toggle-label toggle-label-left" :class="{ active: state.activeProjectType === 'work' }">
        Work
      </span>
      <div class="toggle-track">
        <div class="toggle-knob" :class="{ argonath: state.activeProjectType === 'argonath' }"></div>
      </div>
      <span
        class="toggle-label toggle-label-right"
        :class="{ active: state.activeProjectType === 'argonath' }"
      >
        Argonath
      </span>
    </div>
  </header>
</template>
