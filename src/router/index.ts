import { createRouter, createWebHistory } from 'vue-router'

import StudioView from '@/views/StudioView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'studio',
      component: StudioView,
    },
  ],
})

export default router
