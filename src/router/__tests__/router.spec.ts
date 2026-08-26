import { describe, it, expect } from 'vitest'
import router from '@/router'

describe('static pages router', () => {
  it('resolves the about page as the landing route', async () => {
    await router.push('/')
    await router.isReady()
    expect(router.currentRoute.value.name).toBe('about')
    expect(router.currentRoute.value.path).toBe('/')
  })

  it('resolves the dashboard at /app', async () => {
    await router.push('/app')
    expect(router.currentRoute.value.name).toBe('dashboard')
    expect(router.currentRoute.value.path).toBe('/app')
  })

  it('resolves the privacy policy', async () => {
    await router.push('/privacy')
    expect(router.currentRoute.value.name).toBe('privacy')
  })

  it('resolves the terms and disclaimer', async () => {
    await router.push('/terms')
    expect(router.currentRoute.value.name).toBe('terms')
  })

  it('resolves the contact and support page', async () => {
    await router.push('/contact')
    expect(router.currentRoute.value.name).toBe('contact')
  })

  it('resolves the who-is-behind-this page', async () => {
    await router.push('/who')
    expect(router.currentRoute.value.name).toBe('who')
  })

  it('keeps the existing edit routes reachable', async () => {
    await router.push('/asset/123')
    expect(router.currentRoute.value.name).toBe('edit-asset')

    await router.push('/cashflow/123')
    expect(router.currentRoute.value.name).toBe('edit-cashflow')

    await router.push('/debt/123')
    expect(router.currentRoute.value.name).toBe('edit-debt')
  })
})
