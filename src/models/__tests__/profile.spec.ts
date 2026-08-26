import { describe, it, expect } from 'vitest'
import { UserProfile } from '@/models/profile'
import { LiquidAsset } from '@/models/assets'
import { CashFlow } from '@/models/cashflow'
import { Debt } from '@/models/debt'
import { getCurrentMonth, addMonths } from '@/types/month'
import type { Month } from '@/types/month'

describe('UserProfile Model', () => {
  const birthDate = getCurrentMonth() - 360 // 30 years ago
  const assets = [new LiquidAsset('a1', 'Savings', 1000)]
  const cashFlows = [new CashFlow('c1', 'Salary', 3000, 'income')]
  const debts = [new Debt({ id: 'd1', name: 'Loan', amount: 500, annualInterestRate: 5 })]

  describe('Initialization', () => {
    it('should initialize correctly', () => {
      const profile = new UserProfile(birthDate, assets, cashFlows, 5, debts, 2, 'NL')
      expect(profile.birthDate).toBe(birthDate)
      expect(profile.capitalAccounts).toEqual(assets)
      expect(profile.cashFlows).toEqual(cashFlows)
      expect(profile.debts).toEqual(debts)
      expect(profile.liquidAssetsInterestRate).toBe(5)
      expect(profile.inflationRate).toBe(2)
      expect(profile.taxCountry).toBe('NL')
    })

    it('should throw if birthDate is invalid', () => {
      expect(() => new UserProfile(undefined as unknown as Month, [], [], 5)).toThrow(
        'UserProfile birthDate must be a valid Month value',
      )
    })
  })

  describe('Calculations', () => {
    it('should get age at specific month', () => {
      const profile = new UserProfile(birthDate, assets, cashFlows, 5, debts, 2, 'NL')
      const ageAtMonth = profile.getAgeAt(addMonths(birthDate, 12 * 25))
      expect(ageAtMonth).toBe(25)
    })

    it('should get current age', () => {
      const profile = new UserProfile(birthDate, assets, cashFlows, 5, debts, 2, 'NL')
      const currentAge = profile.getCurrentAge()
      expect(currentAge).toBeGreaterThan(0)
    })

    it('should get total capital', () => {
      const profile = new UserProfile(birthDate, assets, cashFlows, 5, debts, 2, 'NL')
      // 1000 (asset) - 500 (debt) = 500
      expect(profile.getTotalCapital()).toBe(500)
    })

    it('should get total liquid assets', () => {
      const profile = new UserProfile(birthDate, assets, cashFlows, 5, debts, 2, 'NL')
      expect(profile.getTotalLiquidAssets()).toBe(1000)
    })

    it('should get total fixed assets', () => {
      const profile = new UserProfile(birthDate, [], cashFlows, 5, debts, 2, 'NL')
      expect(profile.getTotalFixedAssets()).toBe(0)
    })

    it('should get total debt', () => {
      const profile = new UserProfile(birthDate, assets, cashFlows, 5, debts, 2, 'NL')
      expect(profile.getTotalDebt()).toBe(500)
    })
  })

  describe('Serialization', () => {
    it('should update properties with .with()', () => {
      const profile = new UserProfile(birthDate, assets, cashFlows, 5, debts, 2, 'NL')
      const updated = profile.with({ inflationRate: 4, taxCountry: 'US' })
      expect(updated.inflationRate).toBe(4)
      expect(updated.taxCountry).toBe('US')
      expect(updated.birthDate).toBe(birthDate)
    })

    it('should serialize to JSON correctly', () => {
      const profile = new UserProfile(birthDate, assets, cashFlows, 5, debts, 2, 'NL')
      const json = profile.toJSON()
      expect(json.birthDate).toBe(birthDate)
      expect(json.capitalAccounts).toHaveLength(1)
      expect(json.cashFlows).toHaveLength(1)
      expect(json.debts).toHaveLength(1)
    })

    it('should deserialize from JSON correctly', () => {
      const profile = new UserProfile(birthDate, assets, cashFlows, 5, debts, 2, 'NL')
      const data = profile.toJSON()
      const deserialized = UserProfile.fromJSON(data)
      expect(deserialized.birthDate).toBe(profile.birthDate)
      expect(deserialized.capitalAccounts.length).toBe(1)
      expect(deserialized.cashFlows.length).toBe(1)
      expect(deserialized.debts.length).toBe(1)
      expect(deserialized.taxCountry).toBe('NL')
    })
  })
})
