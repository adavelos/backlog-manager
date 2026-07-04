import { createApp } from 'vue'

import '@/assets/common.css'
import '@/assets/boards.css'
import '@/assets/projects.css'
import '@/assets/notes.css'

import App from './App.vue'
import router from './router'

createApp(App).use(router).mount('#app')
