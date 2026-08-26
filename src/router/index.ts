import { createRouter, createWebHistory } from 'vue-router'
import DashboardView from '@/views/DashboardView.vue'
import EditAssetView from '@/views/EditAssetView.vue'
import EditCashFlowView from '@/views/EditCashFlowView.vue'
import EditDebtView from '@/views/EditDebtView.vue'
import AboutView from '@/views/AboutView.vue'
import PrivacyView from '@/views/PrivacyView.vue'
import TermsView from '@/views/TermsView.vue'
import ContactView from '@/views/ContactView.vue'
import WhoView from '@/views/WhoView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'about',
      component: AboutView,
    },
    {
      path: '/app',
      name: 'dashboard',
      component: DashboardView,
    },
    {
      path: '/asset/new/:typeId',
      name: 'new-asset',
      component: EditAssetView,
      props: true,
    },
    {
      path: '/asset/:id',
      name: 'edit-asset',
      component: EditAssetView,
      props: true,
    },
    {
      path: '/cashflow/new/:typeId',
      name: 'new-cashflow',
      component: EditCashFlowView,
      props: true,
    },
    {
      path: '/cashflow/:id',
      name: 'edit-cashflow',
      component: EditCashFlowView,
      props: true,
    },
    {
      path: '/debt/new/:typeId',
      name: 'new-debt',
      component: EditDebtView,
      props: true,
    },
    {
      path: '/debt/:id',
      name: 'edit-debt',
      component: EditDebtView,
      props: true,
    },
    {
      path: '/privacy',
      name: 'privacy',
      component: PrivacyView,
    },
    {
      path: '/terms',
      name: 'terms',
      component: TermsView,
    },
    {
      path: '/contact',
      name: 'contact',
      component: ContactView,
    },
    {
      path: '/who',
      name: 'who',
      component: WhoView,
    },
  ],
})

export default router
