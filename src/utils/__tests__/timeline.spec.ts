import { describe, it, expect } from 'vitest'
import {
  resolveSelectedYear,
  resolveYearFraction,
  resolveYearIndex,
  resolveLifeEventNavs,
} from '../timeline'
import { fromYearMonth, createAgeDate, type Month } from '@/types/month'

// Projection starts January 2025.
const projectionStart: Month = fromYearMonth(2025, 0)
const years = [2025, 2026, 2027]

describe('timeline helpers', () => {
  it('resolves the calendar year of the selected month', () => {
    expect(resolveSelectedYear(projectionStart, 0)).toBe(2025) // Jan 2025
    expect(resolveSelectedYear(projectionStart, 11)).toBe(2025) // Dec 2025
    expect(resolveSelectedYear(projectionStart, 12)).toBe(2026) // Jan 2026
    expect(resolveSelectedYear(projectionStart, 14)).toBe(2026) // Mar 2026
  })

  it('resolves the fractional position within the calendar year', () => {
    expect(resolveYearFraction(projectionStart, 0)).toBeCloseTo(0, 5) // Jan
    expect(resolveYearFraction(projectionStart, 6)).toBeCloseTo(0.5, 1) // Jul
    expect(resolveYearFraction(projectionStart, 11)).toBeCloseTo(11 / 12, 5) // Dec
    expect(resolveYearFraction(projectionStart, 12)).toBeCloseTo(0, 5) // Jan next year
  })

  it('finds the matching year index in the annual summaries', () => {
    expect(resolveYearIndex(projectionStart, 0, years)).toBe(0)
    expect(resolveYearIndex(projectionStart, 14, years)).toBe(1)
    expect(resolveYearIndex(projectionStart, 26, years)).toBe(2)
  })

  it('returns null when the selected year is outside the summaries', () => {
    expect(resolveYearIndex(projectionStart, 100, years)).toBeNull()
  })
})

describe('resolveLifeEventNavs', () => {
  // Born Jan 1995; projection starts Jan 2025 (age 30).
  const birthDate: Month = fromYearMonth(1995, 0)
  const projectionStart: Month = fromYearMonth(2025, 0)
  const monthlyBalances: { balance: number }[] = []
  for (let i = 0; i < 24; i++) monthlyBalances[i] = { balance: 100000 + i * 5000 }
  monthlyBalances[12] = { balance: 200000 }
  monthlyBalances[23] = { balance: 300000 }

  it('resolves age-based events to their NAV at the right month', () => {
    const events = [
      { id: 'retire', name: 'Retirement', date: createAgeDate(67) }, // monthOffset 444
      { id: 'mid', name: 'Mid-life', date: createAgeDate(31) }, // 2026 = monthOffset 12
    ]
    const result = resolveLifeEventNavs(projectionStart, birthDate, events, monthlyBalances)

    expect(result).toHaveLength(2)
    // Sorted earliest first: Mid-life (offset 12) before Retirement (offset 444).
    expect(result[0]!.eventId).toBe('mid')
    expect(result[0]!.monthOffset).toBe(12)
    expect(result[0]!.age).toBe(31)
    expect(result[0]!.nav).toBe(200000)

    // Retirement falls beyond the 24-month projection -> null NAV.
    expect(result[1]!.eventId).toBe('retire')
    expect(result[1]!.nav).toBeNull()
    expect(result[1]!.age).toBe(67)
  })

  it('skips events without a date', () => {
    const events = [{ id: 'no-date', name: 'Undated', date: undefined }]
    const result = resolveLifeEventNavs(projectionStart, birthDate, events, monthlyBalances)
    expect(result).toHaveLength(0)
  })

  it('returns null NAV for events before the projection start', () => {
    const events = [{ id: 'past', name: 'Past', date: createAgeDate(20) }] // 2015, before 2025
    const result = resolveLifeEventNavs(projectionStart, birthDate, events, monthlyBalances)
    expect(result[0]!.nav).toBeNull()
    expect(result[0]!.monthOffset).toBeLessThan(0)
  })
})
