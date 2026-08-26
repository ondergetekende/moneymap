import { describe, it, expect } from 'vitest'
import { formatCurrency, adjustForInflation } from '@/utils/format'

describe('Utils', () => {
  describe('formatCurrency', () => {
    it('should format numbers as EUR currency', () => {
      // Use regex for currency because different environments might use different non-breaking spaces
      expect(formatCurrency(1000)).toMatch(/€\s?1,000/)
      expect(formatCurrency(0)).toMatch(/€\s?0/)
      expect(formatCurrency(-500)).toMatch(/-€\s?500/)
    })
  })

  describe('adjustForInflation', () => {
    it('should return the original value if inflation rate is 0 or undefined', () => {
      expect(adjustForInflation(1000, 5, 0)).toBe(1000)
      expect(adjustForInflation(1000, 5, undefined)).toBe(1000)
    })

    it('should adjust value based on inflation rate', () => {
      // 1000 / (1 + 0.02)^5 = 1000 / 1.10408 = 905.73
      const result = adjustForInflation(1000, 5, 2)
      expect(result).toBeCloseTo(905.73, 2)
    })
  })
})
