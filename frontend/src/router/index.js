import { createRouter, createWebHistory } from 'vue-router'

// "/" and "/boards" pick the phone or desktop screen by viewport width (see HomeRoute, BoardsRoute).
const HomeRoute = () => import('@/views/HomeRoute.vue')
const BoardsRoute = () => import('@/views/BoardsRoute.vue')
const ProjectsPage = () => import('@/views/ProjectsPage.vue')
const NotesPage = () => import('@/views/NotesPage.vue')

const routes = [
  { path: '/', name: 'home', component: HomeRoute, meta: { title: 'Backlog Manager' } },
  { path: '/boards', name: 'boards', component: BoardsRoute, meta: { title: 'Boards - Backlog Manager' } },
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
