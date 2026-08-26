import { describe, it, expect } from 'vitest'
import { CashFlow, isCashFlow } from '@/models/cashflow'
import { createAbsoluteDate } from '@/types/month'

describe('CashFlow Model', () => {
  describe('Initialization', () => {
    it('should initialize correctly with default values', () => {
      const cf = new CashFlow('1', 'Salary', 3000, 'income')
      expect(cf.id).toBe('1')
      expect(cf.name).toBe('Salary')
      expect(cf.amount).toBe(3000)
      expect(cf.type).toBe('income')
      expect(cf.followsInflation).toBe(true)
      expect(cf.isOneTime).toBe(false)
      expect(cf.frequency).toBe('monthly')
    })

    it('should initialize correctly with custom values', () => {
      const date = createAbsoluteDate(600)
      const cf = new CashFlow(
        '2',
        'Bonus',
        500,
        'income',
        date,
        undefined,
        false,
        true,
        'after-tax',
        'annual',
      )
      expect(cf.startDate).toEqual(date)
      expect(cf.isOneTime).toBe(true)
      expect(cf.incomeTaxId).toBe('after-tax')
      expect(cf.frequency).toBe('annual')
    })

    it('should throw if amount is negative', () => {
      expect(() => new CashFlow('1', 'Salary', -100, 'income')).toThrow(
        'CashFlow amount cannot be negative',
      )
    })

    it('should throw if one-time and startDate is missing', () => {
      expect(
        () => new CashFlow('1', 'Gift', 100, 'income', undefined, undefined, true, true),
      ).toThrow('One-time transactions must have a start date')
    })
  })

  describe('Frequency Conversions', () => {
    it('should handle weekly frequency', () => {
      const cf = new CashFlow(
        '1',
        'Weekly',
        100,
        'income',
        undefined,
        undefined,
        true,
        false,
        undefined,
        'weekly',
      )
      // Monthly: (100 * 52) / 12 = 433.33
      expect(cf.monthlyAmount).toBeCloseTo(433.33, 2)
      // Annual: 100 * 52 = 5200
      expect(cf.annualAmount).toBe(5200)
      // Weekly: 100
      expect(cf.weeklyAmount).toBe(100)
    })

    it('should handle monthly frequency', () => {
      const cf = new CashFlow(
        '1',
        'Monthly',
        1000,
        'income',
        undefined,
        undefined,
        true,
        false,
        undefined,
        'monthly',
      )
      expect(cf.monthlyAmount).toBe(1000)
      expect(cf.annualAmount).toBe(12000)
      // Weekly: (1000 * 12) / 52 = 230.77
      expect(cf.weeklyAmount).toBeCloseTo(230.77, 2)
    })

    it('should handle annual frequency', () => {
      const cf = new CashFlow(
        '1',
        'Annual',
        12000,
        'income',
        undefined,
        undefined,
        true,
        false,
        undefined,
        'annual',
      )
      expect(cf.annualAmount).toBe(12000)
      expect(cf.monthlyAmount).toBe(1000)
      // Weekly: 12000 / 52 = 230.77
      expect(cf.weeklyAmount).toBeCloseTo(230.77, 2)
    })
  })

  describe('Updates and Serialization', () => {
    it('should update properties with .with()', () => {
      const cf = new CashFlow('1', 'Salary', 3000, 'income')
      const updated = cf.with({ amount: 3500, frequency: 'annual' })
      expect(updated.amount).toBe(3500)
      expect(updated.frequency).toBe('annual')
      expect(updated.id).toBe('1')
    })

    it('should serialize to JSON correctly', () => {
      const cf = new CashFlow('1', 'Salary', 3000, 'income')
      const json = cf.toJSON()
      expect(json.amount).toBe(3000)
      expect(json.type).toBe('income')
    })

    it('should deserialize from JSON correctly', () => {
      const data: Record<string, unknown> = {
        id: '2',
        name: 'Bonus',
        amount: 500,
        type: 'income',
        frequency: 'annual',
      }
      const cf = CashFlow.fromJSON(data)
      expect(cf.id).toBe('2')
      expect(cf.amount).toBe(500)
      expect(cf.frequency).toBe('annual')
    })

    it('should handle legacy monthlyAmount in fromJSON', () => {
      const data: Record<string, unknown> = {
        id: '2',
        name: 'Old Cashflow',
        monthlyAmount: 1000,
        type: 'expense',
        frequency: 'monthly',
      }
      const cf = CashFlow.fromJSON(data)
      expect(cf.amount).toBe(1000)
    })

    it('should detect instance via isCashFlow', () => {
      const cf = new CashFlow('1', 'Salary', 3000, 'income')
      expect(isCashFlow(cf)).toBe(true)
    })
  })
})
