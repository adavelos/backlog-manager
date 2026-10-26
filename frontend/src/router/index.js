import { createRouter, createWebHistory } from 'vue-router'

const HomePage = () => import('@/views/HomePage.vue')
const BoardsPage = () => import('@/views/BoardsPage.vue')
const ProjectsPage = () => import('@/views/ProjectsPage.vue')
const NotesPage = () => import('@/views/NotesPage.vue')

const routes = [
  { path: '/', name: 'home', component: HomePage, meta: { title: 'Backlog Manager' } },
  { path: '/boards', name: 'boards', component: BoardsPage, meta: { title: 'Boards - Backlog Manager' } },
  { path: '/projects', name: 'projects', component: ProjectsPage, meta: { title: 'Projects - Backlog Manager' } },
  { path: '/notes', name: 'notes', component: NotesPage, meta: { title: 'Notes - Backlog Manager' } },
  { path: '/:pathMatch(.*)*', redirect: '/' },
]

const router = createRouter({
  // The app's own directory, so routes work at the root and under a path prefix.
  history: createWebHistory(new URL('.', document.baseURI).pathname),
  routes,
  scrollBehavior(to, from, savedPosition) {
    return savedPosition || { top: 0 }
  },
})

router.afterEach((to) => {
  document.title = to.meta.title || 'Backlog Manager'
})

export default router
