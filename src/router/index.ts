import { createRouter, createWebHashHistory } from 'vue-router'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: 'templates',
      component: () => import('@/views/TemplateListView.vue')
    },
    {
      path: '/designer/:id?',
      name: 'designer',
      component: () => import('@/views/DesignerView.vue')
    },
    {
      path: '/preview/:id',
      name: 'preview',
      component: () => import('@/views/PreviewView.vue')
    }
  ]
})

export default router
