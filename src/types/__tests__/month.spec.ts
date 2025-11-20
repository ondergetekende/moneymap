import { describe, it, expect } from 'vitest'
import {
  type Month,
  type DateSpecification,
  type LifeEventLike,
  fromYearMonth,
  resolveDate,
  createAbsoluteDate,
  createAgeDate,
  createLifeEventDate,
  isValidAge,
} from '../month'

describe('DateSpecification', () => {
  const birthDate: Month = fromYearMonth(1968, 0) // January 1968

  describe('createAbsoluteDate', () => {
    it('should create absolute date specification', () => {
      const month = fromYearMonth(2035, 0)
      const spec = createAbsoluteDate(month)

      expect(spec).toEqual({ type: 'absolute', month })
    })
  })

  describe('createAgeDate', () => {
    it('should create age-based date specification', () => {
      const spec = createAgeDate(67)

      expect(spec).toEqual({ type: 'age', age: 67 })
    })
  })

  describe('createLifeEventDate', () => {
    it('should create life event date specification', () => {
      const spec = createLifeEventDate('retirement-id')

      expect(spec).toEqual({ type: 'lifeEvent', eventId: 'retirement-id' })
    })
  })

  describe('isValidAge', () => {
    it('should validate reasonable ages', () => {
      expect(isValidAge(0)).toBe(true)
      expect(isValidAge(67)).toBe(true)
      expect(isValidAge(120)).toBe(true)
    })

    it('should reject invalid ages', () => {
      expect(isValidAge(-1)).toBe(false)
      expect(isValidAge(121)).toBe(false)
      expect(isValidAge(NaN)).toBe(false)
      expect(isValidAge(Infinity)).toBe(false)
    })
  })

  describe('resolveDate', () => {
    describe('absolute dates', () => {
      it('should resolve absolute date to itself', () => {
        const month = fromYearMonth(2035, 0)
        const spec: DateSpecification = { type: 'absolute', month }

        const resolved = resolveDate(spec, birthDate)

        expect(resolved).toBe(month)
      })

      it('should return undefined for undefined spec', () => {
        const resolved = resolveDate(undefined, birthDate)

        expect(resolved).toBeUndefined()
      })
    })

    describe('age-based dates', () => {
      it('should resolve age to absolute month', () => {
        const spec: DateSpecification = { type: 'age', age: 67 }

        const resolved = resolveDate(spec, birthDate)

        // Birth: January 1968 + 67 years = January 2035
        expect(resolved).toBe(fromYearMonth(2035, 0))
      })

      it('should handle age 0', () => {
        const spec: DateSpecification = { type: 'age', age: 0 }

        const resolved = resolveDate(spec, birthDate)

        expect(resolved).toBe(birthDate)
      })

      it('should handle fractional ages by truncating', () => {
        const spec: DateSpecification = { type: 'age', age: 67.5 }

        const resolved = resolveDate(spec, birthDate)

        // 67.5 * 12 = 810 months from birth
        expect(resolved).toBe(birthDate + 810)
      })
    })

    describe('life event dates', () => {
      it('should resolve life event with absolute date', () => {
        const eventDate = fromYearMonth(2035, 0)
        const lifeEvents: LifeEventLike[] = [
          {
            id: 'retirement',
            name: 'Retirement',
            date: { type: 'absolute', month: eventDate },
          },
        ]
        const spec: DateSpecification = { type: 'lifeEvent', eventId: 'retirement' }

        const resolved = resolveDate(spec, birthDate, lifeEvents)

        expect(resolved).toBe(eventDate)
      })

      it('should resolve life event with age-based date', () => {
        const lifeEvents: LifeEventLike[] = [
          {
            id: 'retirement',
            name: 'Retirement',
            date: { type: 'age', age: 67 },
          },
        ]
        const spec: DateSpecification = { type: 'lifeEvent', eventId: 'retirement' }

        const resolved = resolveDate(spec, birthDate, lifeEvents)

        expect(resolved).toBe(fromYearMonth(2035, 0))
      })

      it('should return undefined if life event not found', () => {
        const lifeEvents: LifeEventLike[] = []
        const spec: DateSpecification = { type: 'lifeEvent', eventId: 'retirement' }

        const resolved = resolveDate(spec, birthDate, lifeEvents)

        expect(resolved).toBeUndefined()
      })

      it('should return undefined if life event date is undefined', () => {
        const lifeEvents: LifeEventLike[] = [
          {
            id: 'retirement',
            name: 'Retirement',
            date: undefined,
          },
        ]
        const spec: DateSpecification = { type: 'lifeEvent', eventId: 'retirement' }

        const resolved = resolveDate(spec, birthDate, lifeEvents)

        expect(resolved).toBeUndefined()
      })

      it('should return undefined if no life events provided', () => {
        const spec: DateSpecification = { type: 'lifeEvent', eventId: 'retirement' }

        const resolved = resolveDate(spec, birthDate, undefined)

        expect(resolved).toBeUndefined()
      })
    })

    describe('circular reference detection', () => {
      it('should detect direct circular reference', () => {
        const lifeEvents: LifeEventLike[] = [
          {
            id: 'event-a',
            name: 'Event A',
            date: { type: 'lifeEvent', eventId: 'event-a' },
          },
        ]
        const spec: DateSpecification = { type: 'lifeEvent', eventId: 'event-a' }

        const resolved = resolveDate(spec, birthDate, lifeEvents)

        expect(resolved).toBeUndefined()
      })

      it('should detect indirect circular reference', () => {
        const lifeEvents: LifeEventLike[] = [
          {
            id: 'event-a',
            name: 'Event A',
            date: { type: 'lifeEvent', eventId: 'event-b' },
          },
          {
            id: 'event-b',
            name: 'Event B',
            date: { type: 'lifeEvent', eventId: 'event-a' },
          },
        ]
        const spec: DateSpecification = { type: 'lifeEvent', eventId: 'event-a' }

        const resolved = resolveDate(spec, birthDate, lifeEvents)

        expect(resolved).toBeUndefined()
      })

      it('should handle longer circular chains', () => {
        const lifeEvents: LifeEventLike[] = [
          {
            id: 'event-a',
            name: 'Event A',
            date: { type: 'lifeEvent', eventId: 'event-b' },
          },
          {
            id: 'event-b',
            name: 'Event B',
            date: { type: 'lifeEvent', eventId: 'event-c' },
          },
          {
            id: 'event-c',
            name: 'Event C',
            date: { type: 'lifeEvent', eventId: 'event-a' },
          },
        ]
        const spec: DateSpecification = { type: 'lifeEvent', eventId: 'event-a' }

        const resolved = resolveDate(spec, birthDate, lifeEvents)

        expect(resolved).toBeUndefined()
      })
    })

    describe('nested resolution', () => {
      it('should resolve life event → age → month', () => {
        const lifeEvents: LifeEventLike[] = [
          {
            id: 'retirement',
            name: 'Retirement',
            date: { type: 'age', age: 67 },
          },
        ]
        const spec: DateSpecification = { type: 'lifeEvent', eventId: 'retirement' }

        const resolved = resolveDate(spec, birthDate, lifeEvents)

        expect(resolved).toBe(fromYearMonth(2035, 0))
      })

      it('should resolve life event → life event → age → month', () => {
        const lifeEvents: LifeEventLike[] = [
          {
            id: 'early-retirement',
            name: 'Early Retirement',
            date: { type: 'age', age: 65 },
          },
          {
            id: 'full-retirement',
            name: 'Full Retirement',
            date: { type: 'lifeEvent', eventId: 'early-retirement' },
          },
        ]
        const spec: DateSpecification = { type: 'lifeEvent', eventId: 'full-retirement' }

        const resolved = resolveDate(spec, birthDate, lifeEvents)

        expect(resolved).toBe(fromYearMonth(2033, 0))
      })
    })
  })
})
