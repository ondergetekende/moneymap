import { describe, it, expect } from 'vitest'
import { calculateProjections } from '../calculator'
import { createSampleProfile } from '../sampleData'
import { resolveLifeEventNavs } from '@/utils/timeline'
import { getCurrentMonth } from '@/types/month'

describe('createSampleProfile', () => {
  it('projects a positive net worth at retirement', () => {
    const profile = createSampleProfile()
    const result = calculateProjections(profile)
    const navs = resolveLifeEventNavs(
      getCurrentMonth(),
      profile.birthDate,
      profile.lifeEvents,
      result.monthlyProjections,
    )
    const retirement = navs.find((e) => e.name === 'Retirement')
    expect(retirement?.age).toBe(67)
    expect(retirement?.nav).toBeGreaterThan(100000)
  })
})
