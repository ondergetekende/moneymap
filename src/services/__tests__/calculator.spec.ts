import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { calculateProjections } from '../calculator'
import { UserProfile, LiquidAsset, FixedAsset, CashFlow, Debt } from '@/models'
import type { Month } from '@/types/month'
import { stringToMonth } from '@/types/month'

// Helper to create test profiles using classes
function createTestProfile(data: {
  birthDate: string
  capitalAccounts: Array<{ id: string; name: string; amount: number; assetType: 'liquid' | 'fixed'; annualInterestRate?: number; liquidationDate?: string | Month }>
  liquidAssetsInterestRate: number
  cashFlows: Array<{ id: string; name: string; monthlyAmount: number; type: 'income' | 'expense'; startDate?: string | Month; endDate?: string | Month }>
}): UserProfile {
  const accounts = data.capitalAccounts.map(acc => {
    if (acc.assetType === 'fixed') {
      const liquidationDate = typeof acc.liquidationDate === 'string' ? stringToMonth(acc.liquidationDate) : acc.liquidationDate
      return new FixedAsset(acc.id, acc.name, acc.amount, acc.annualInterestRate || 0, liquidationDate)
    } else {
      return new LiquidAsset(acc.id, acc.name, acc.amount)
    }
  })

  const flows = data.cashFlows.map(cf => {
    const startDate = typeof cf.startDate === 'string' ? stringToMonth(cf.startDate) : cf.startDate
    const endDate = typeof cf.endDate === 'string' ? stringToMonth(cf.endDate) : cf.endDate
    return new CashFlow(cf.id, cf.name, cf.monthlyAmount, cf.type, startDate, endDate)
  })

  const birthMonth = stringToMonth(data.birthDate)!
  return new UserProfile(birthMonth, accounts, flows, data.liquidAssetsInterestRate)
}

describe('Financial Calculator', () => {
  beforeEach(() => {
    // Mock current date to 2025-01-01
    vi.setSystemTime(new Date('2025-01-01'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should calculate projections correctly', () => {
    const profile = createTestProfile({
      birthDate: '1995-01-01', // 30 years old in 2025
      capitalAccounts: [{ id: '1', name: 'Savings', amount: 100000, assetType: 'liquid' }],
      liquidAssetsInterestRate: 0,
      cashFlows: [
        {
          id: '1',
          name: 'Rent',
          monthlyAmount: 1000,
          startDate: stringToMonth('2025-01-01')!,
          endDate: stringToMonth('2060-01-01')!,
          type: 'expense',
        },
        {
          id: '2',
          name: 'Food',
          monthlyAmount: 500,
          startDate: stringToMonth('2025-01-01')!,
          endDate: stringToMonth('2095-01-01')!,
          type: 'expense',
        },
      ],
    })

    const result = calculateProjections(profile)

    expect(result.monthlyProjections.length).toBeGreaterThan(0)
    expect(result.annualSummaries.length).toBeGreaterThan(0)
    expect(result.annualSummaries[0]?.year).toBe(2025)
    expect(result.annualSummaries[0]?.age).toBe(30)
    expect(result.annualSummaries[0]?.startingBalance).toBe(100000)
  })

  it('should handle expenses with different date ranges', () => {
    const profile = createTestProfile({
      birthDate: '2000-01-01', // 25 years old in 2025
      capitalAccounts: [{ id: '1', name: 'Savings', amount: 50000, assetType: 'liquid' }],
      liquidAssetsInterestRate: 0,
      cashFlows: [
        {
          id: '1',
          name: 'Rent',
          monthlyAmount: 1000,
          startDate: stringToMonth('2025-01-01')!,
          endDate: stringToMonth('2030-01-01')!,
          type: 'expense',
        },
        {
          id: '2',
          name: 'Retirement',
          monthlyAmount: 500,
          startDate: stringToMonth('2060-01-01')!,
          endDate: stringToMonth('2095-01-01')!,
          type: 'expense',
        },
      ],
    })

    const result = calculateProjections(profile)

    // Check first year has rent expense (but only 11 months since we're already in January)
    const firstYear = result.annualSummaries[0]
    expect(firstYear?.totalExpenses).toBeGreaterThan(10000) // Should have most of the year

    // Check year at 2040 has no expenses (between rent and retirement)
    const midYear = result.annualSummaries.find((s) => s.year === 2040)
    expect(midYear?.totalExpenses).toBe(0)

    // Check year at 2060 has retirement expense (partial year)
    const retirementYear = result.annualSummaries.find((s) => s.year === 2060)
    expect(retirementYear?.totalExpenses).toBeGreaterThan(0)
  })

  it('should meet performance requirement with 20+ cashflows', () => {
    // Create 25 cashflows to test performance
    const cashFlows = []
    for (let i = 0; i < 25; i++) {
      cashFlows.push({
        id: `cashflow-${i}`,
        name: `Expense ${i}`,
        monthlyAmount: 100 + i * 10,
        type: 'expense' as const,
        startDate: `${2025 + (i % 30)}-01-01`,
        endDate: `${2055 + (i % 40)}-01-01`,
      })
    }

    const profile = createTestProfile({
      birthDate: '1995-01-01', // 30 years old in 2025
      capitalAccounts: [{ id: '1', name: 'Savings', amount: 500000, assetType: 'liquid' }],
      liquidAssetsInterestRate: 0,
      cashFlows,
    })

    const result = calculateProjections(profile)

    // Performance requirement: < 300ms
    expect(result.calculationTimeMs).toBeLessThan(300)
    expect(result.annualSummaries.length).toBeGreaterThan(0)
  })

  it('should handle multiple capital accounts', () => {
    const profile = createTestProfile({
      birthDate: '1990-01-01', // 35 years old in 2025
      capitalAccounts: [
        { id: '1', name: 'Checking', amount: 10000, assetType: 'liquid' },
        { id: '2', name: 'Savings', amount: 50000, assetType: 'liquid' },
        { id: '3', name: 'Investment', amount: 100000, assetType: 'liquid' },
      ],
      liquidAssetsInterestRate: 0,
      cashFlows: [
        {
          id: '1',
          name: 'Living',
          monthlyAmount: 2000,
          startDate: stringToMonth('2025-01-01')!,
          endDate: stringToMonth('2095-01-01')!,
          type: 'expense',
        },
      ],
    })

    const result = calculateProjections(profile)

    // Should start with total of all accounts
    expect(result.annualSummaries[0]?.startingBalance).toBe(160000)
  })

  it('should handle negative balances correctly', () => {
    const profile = createTestProfile({
      birthDate: '1995-01-01', // 30 years old in 2025
      capitalAccounts: [{ id: '1', name: 'Savings', amount: 10000, assetType: 'liquid' }],
      liquidAssetsInterestRate: 0,
      cashFlows: [
        {
          id: '1',
          name: 'High Expense',
          monthlyAmount: 5000,
          startDate: stringToMonth('2025-01-01')!,
          endDate: stringToMonth('2095-01-01')!,
          type: 'expense',
        },
      ],
    })

    const result = calculateProjections(profile)

    // Should go negative after initial capital is exhausted
    const laterYear = result.annualSummaries.find((s) => s.year === 2027)
    expect(laterYear?.endingBalance).toBeLessThan(0)
  })

  it('should calculate age correctly', () => {
    const profile = createTestProfile({
      birthDate: '1990-05-15',
      capitalAccounts: [{ id: '1', name: 'Savings', amount: 10000, assetType: 'liquid' }],
      liquidAssetsInterestRate: 0,
      cashFlows: [],
    })

    const result = calculateProjections(profile)

    // In 2025-01-01 (mocked date), person born 1990-05-15 is 34 (hasn't had birthday yet)
    const firstYear = result.annualSummaries[0]
    expect(firstYear?.age).toBe(34)
  })

  it('should handle income correctly', () => {
    const profile = createTestProfile({
      birthDate: '1995-01-01', // 30 years old in 2025
      capitalAccounts: [{ id: '1', name: 'Savings', amount: 50000, assetType: 'liquid' }],
      liquidAssetsInterestRate: 0,
      cashFlows: [
        {
          id: '1',
          name: 'Salary',
          monthlyAmount: 5000,
          startDate: stringToMonth('2025-01-01')!,
          endDate: stringToMonth('2060-01-01')!,
          type: 'income',
        },
        {
          id: '2',
          name: 'Rent',
          monthlyAmount: 1500,
          startDate: stringToMonth('2025-01-01')!,
          endDate: stringToMonth('2060-01-01')!,
          type: 'expense',
        },
      ],
    })

    const result = calculateProjections(profile)

    // Check first year has both income and expenses
    const firstYear = result.annualSummaries[0]
    expect(firstYear?.totalIncome).toBeCloseTo(60000, -2) // 12 months of income (5000 * 12)
    expect(firstYear?.totalExpenses).toBeCloseTo(18000, -2) // 12 months of expenses (1500 * 12)

    // Balance should grow since income > expenses
    if (firstYear) {
      expect(firstYear.endingBalance).toBeGreaterThan(firstYear.startingBalance)
    }
  })

  it('should handle mixed income and expenses', () => {
    const profile = createTestProfile({
      birthDate: '1990-01-01', // 35 years old in 2025
      capitalAccounts: [{ id: '1', name: 'Checking', amount: 20000, assetType: 'liquid' }],
      liquidAssetsInterestRate: 0,
      cashFlows: [
        {
          id: '1',
          name: 'Job Salary',
          monthlyAmount: 6000,
          startDate: stringToMonth('2025-01-01')!,
          endDate: stringToMonth('2055-01-01')!,
          type: 'income',
        },
        {
          id: '2',
          name: 'Pension',
          monthlyAmount: 3000,
          startDate: stringToMonth('2055-01-01')!,
          endDate: stringToMonth('2095-01-01')!,
          type: 'income',
        },
        {
          id: '3',
          name: 'Rent',
          monthlyAmount: 2000,
          startDate: stringToMonth('2025-01-01')!,
          endDate: stringToMonth('2095-01-01')!,
          type: 'expense',
        },
        {
          id: '4',
          name: 'Food',
          monthlyAmount: 800,
          startDate: stringToMonth('2025-01-01')!,
          endDate: stringToMonth('2095-01-01')!,
          type: 'expense',
        },
      ],
    })

    const result = calculateProjections(profile)

    // Check working years (2025-2054) - should accumulate wealth
    const workingYear = result.annualSummaries.find((s) => s.year === 2030)
    expect(workingYear?.totalIncome).toBeCloseTo(72000, -2) // 6000 * 12
    expect(workingYear?.totalExpenses).toBeCloseTo(33600, -2) // (2000 + 800) * 12
    if (workingYear) {
      expect(workingYear.endingBalance).toBeGreaterThan(workingYear.startingBalance)
    }

    // Check retirement years (2055+) - should have pension income
    const retirementYear = result.annualSummaries.find((s) => s.year === 2060)
    expect(retirementYear?.totalIncome).toBeCloseTo(36000, -2) // 3000 * 12
    expect(retirementYear?.totalExpenses).toBeCloseTo(33600, -2) // (2000 + 800) * 12
  })

  it('should handle cash flows with no start date (active from beginning)', () => {
    const profile = createTestProfile({
      birthDate: '1995-01-01', // 30 years old in 2025
      capitalAccounts: [{ id: '1', name: 'Savings', amount: 100000, assetType: 'liquid' }],
      liquidAssetsInterestRate: 0,
      cashFlows: [
        { id: '1', name: 'Rent', monthlyAmount: 1000, endDate: stringToMonth('2030-01-01')!, type: 'expense' },
        // No startDate - should be active immediately
      ],
    })

    const result = calculateProjections(profile)

    // First year should have rent expense
    const firstYear = result.annualSummaries[0]
    expect(firstYear?.totalExpenses).toBeGreaterThan(10000)

    // After 2030, should have no expenses
    const afterExpense = result.annualSummaries.find((s) => s.year === 2031)
    expect(afterExpense?.totalExpenses).toBe(0)
  })

  it('should handle cash flows with no end date (active forever)', () => {
    const profile = createTestProfile({
      birthDate: '1995-01-01', // 30 years old in 2025
      capitalAccounts: [{ id: '1', name: 'Savings', amount: 500000, assetType: 'liquid' }],
      liquidAssetsInterestRate: 0,
      cashFlows: [
        {
          id: '1',
          name: 'Basic Living',
          monthlyAmount: 1500,
          startDate: stringToMonth('2025-01-01')!,
          type: 'expense',
        },
        // No endDate - should continue forever
      ],
    })

    const result = calculateProjections(profile)

    // First year should have expenses
    const firstYear = result.annualSummaries[0]
    expect(firstYear?.totalExpenses).toBeCloseTo(18000, -2) // 12 months

    // Last year (near age 100) should also have expenses
    const lastYear = result.annualSummaries[result.annualSummaries.length - 1]
    expect(lastYear?.totalExpenses).toBeCloseTo(18000, -2) // 12 months
  })

  it('should handle cash flows with neither start nor end date (always active)', () => {
    const profile = createTestProfile({
      birthDate: '1995-01-01', // 30 years old in 2025
      capitalAccounts: [{ id: '1', name: 'Savings', amount: 300000, assetType: 'liquid' }],
      liquidAssetsInterestRate: 0,
      cashFlows: [
        { id: '1', name: 'Universal Basic Income', monthlyAmount: 1000, type: 'income' },
        // No dates - always active
      ],
    })

    const result = calculateProjections(profile)

    // Every year should have income
    // Note: First year has 12 months because no start date means active from projection start (Jan 1)
    const firstYear = result.annualSummaries[0]
    expect(firstYear?.totalIncome).toBeCloseTo(12000, -2) // 12 months (starts from Jan 1)

    const middleYear = result.annualSummaries.find((s) => s.year === 2050)
    expect(middleYear?.totalIncome).toBeCloseTo(12000, -2) // 12 months

    const lastYear = result.annualSummaries[result.annualSummaries.length - 1]
    expect(lastYear?.totalIncome).toBeCloseTo(12000, -2) // 12 months
  })

  it('should handle mixed optional and required dates', () => {
    const profile = createTestProfile({
      birthDate: '1995-01-01', // 30 years old in 2025
      capitalAccounts: [{ id: '1', name: 'Savings', amount: 200000, assetType: 'liquid' }],
      liquidAssetsInterestRate: 0,
      cashFlows: [
        { id: '1', name: 'Permanent Expense', monthlyAmount: 500, type: 'expense' }, // No dates
        {
          id: '2',
          name: 'Early Expense',
          monthlyAmount: 300,
          endDate: stringToMonth('2030-01-01')!,
          type: 'expense',
        }, // Only end
        {
          id: '3',
          name: 'Late Expense',
          monthlyAmount: 400,
          startDate: stringToMonth('2060-01-01')!,
          type: 'expense',
        }, // Only start
        {
          id: '4',
          name: 'Fixed Period',
          monthlyAmount: 200,
          startDate: stringToMonth('2040-01-01')!,
          endDate: stringToMonth('2050-01-01')!,
          type: 'expense',
        }, // Both dates
      ],
    })

    const result = calculateProjections(profile)

    // 2025: Permanent + Early = 500 + 300 = 800
    // Note: Both with no start date are active from Jan 1, so 12 months
    const year2025 = result.annualSummaries.find((s) => s.year === 2025)
    expect(year2025?.totalExpenses).toBeCloseTo(9600, -2) // 800 * 12 months

    // 2035: Permanent only = 500
    const year2035 = result.annualSummaries.find((s) => s.year === 2035)
    expect(year2035?.totalExpenses).toBeCloseTo(6000, -2) // 500 * 12

    // 2045: Permanent + Fixed Period = 500 + 200 = 700
    const year2045 = result.annualSummaries.find((s) => s.year === 2045)
    expect(year2045?.totalExpenses).toBeCloseTo(8400, -2) // 700 * 12

    // 2065: Permanent + Late = 500 + 400 = 900
    const year2065 = result.annualSummaries.find((s) => s.year === 2065)
    expect(year2065?.totalExpenses).toBeCloseTo(10800, -2) // 900 * 12
  })

  it('should apply 5% annual interest compounded monthly', () => {
    const profile = createTestProfile({
      birthDate: '1995-01-01', // 30 years old in 2025
      capitalAccounts: [{ id: '1', name: 'Investment', amount: 100000, assetType: 'liquid' }],
      liquidAssetsInterestRate: 5,
      cashFlows: [], // No cash flows, only interest
    })

    const result = calculateProjections(profile)

    // After 1 year with 5% annual rate compounded monthly:
    // Formula: P * (1 + r/12)^12
    // 100000 * (1 + 0.05/12)^12 ≈ 105116
    const firstYear = result.annualSummaries[0]
    expect(firstYear?.startingBalance).toBe(100000)
    expect(firstYear?.endingBalance).toBeCloseTo(105116, 0) // Allow some rounding variance

    // After 10 years: 100000 * (1 + 0.05/12)^120 ≈ 164701
    const year2034 = result.annualSummaries.find((s) => s.year === 2034)
    expect(year2034?.endingBalance).toBeCloseTo(164701, 0)
  })

  it('should handle different interest rates for multiple accounts', () => {
    const profile = createTestProfile({
      birthDate: '1990-01-01', // 35 years old in 2025
      capitalAccounts: [
        { id: '1', name: 'Checking', amount: 10000, assetType: 'liquid' }, // No interest
        { id: '2', name: 'Savings', amount: 50000, assetType: 'liquid' }, // 2% interest
        { id: '3', name: 'Investment', amount: 40000, assetType: 'liquid' }, // 7% interest
      ],
      liquidAssetsInterestRate: 3.8,
      cashFlows: [],
    })

    const result = calculateProjections(profile)

    // Total starting: 100000
    // All liquid accounts are pooled with weighted average rate:
    // (10000*0 + 50000*2 + 40000*7) / 100000 = 3.8%
    // After 1 year: 100000 * (1 + 0.038/12)^12 ≈ 103867
    const firstYear = result.annualSummaries[0]
    expect(firstYear?.startingBalance).toBe(100000)
    expect(firstYear?.endingBalance).toBeCloseTo(103867, 0)
  })

  it('should apply interest before applying cash flows', () => {
    const profile = createTestProfile({
      birthDate: '1995-01-01', // 30 years old in 2025
      capitalAccounts: [{ id: '1', name: 'Investment', amount: 100000, assetType: 'liquid' }],
      liquidAssetsInterestRate: 5,
      cashFlows: [
        {
          id: '1',
          name: 'Monthly Contribution',
          monthlyAmount: 1000,
          startDate: stringToMonth('2025-01-01')!,
          type: 'income',
        },
      ],
    })

    const result = calculateProjections(profile)

    // After 1 year with monthly contributions and compound interest
    // Each month: apply interest first, then add income
    // Starting in Jan 2025, we get contributions and compound interest over the year
    // Result should be ~117395 (12 months of contributions + compound interest)
    const firstYear = result.annualSummaries[0]
    expect(firstYear?.totalIncome).toBeCloseTo(12000, -2) // 12 months of 1000
    expect(firstYear?.endingBalance).toBeCloseTo(117395, 0) // Principal + interest + contributions
  })

  it('should handle negative balances with interest correctly', () => {
    const profile = createTestProfile({
      birthDate: '1995-01-01', // 30 years old in 2025
      capitalAccounts: [{ id: '1', name: 'Account', amount: 10000, assetType: 'liquid' }],
      liquidAssetsInterestRate: 5,
      cashFlows: [
        {
          id: '1',
          name: 'Large Expense',
          monthlyAmount: 2000,
          startDate: stringToMonth('2025-01-01')!,
          type: 'expense',
        },
      ],
    })

    const result = calculateProjections(profile)

    // Should go negative after a few months
    // Even when negative, interest should still be applied (which makes it more negative)
    const firstYear = result.annualSummaries[0]
    expect(firstYear?.endingBalance).toBeLessThan(0)

    // After several years, should be significantly negative due to compounding
    const laterYear = result.annualSummaries.find((s) => s.year === 2030)
    expect(laterYear?.endingBalance).toBeLessThan(-100000)
  })

  it('should distribute cash flows proportionally across accounts with different rates', () => {
    const profile = createTestProfile({
      birthDate: '1995-01-01', // 30 years old in 2025
      capitalAccounts: [
        { id: '1', name: 'Low Rate', amount: 50000, assetType: 'liquid' },
        { id: '2', name: 'High Rate', amount: 50000, assetType: 'liquid' },
      ],
      liquidAssetsInterestRate: 5.5,
      cashFlows: [
        {
          id: '1',
          name: 'Expense',
          monthlyAmount: 1000,
          startDate: stringToMonth('2025-01-01')!,
          type: 'expense',
        },
      ],
    })

    const result = calculateProjections(profile)

    // Both accounts start with same amount, so expenses are split 50/50
    // After 1 year, high rate account should have grown more despite withdrawals
    const firstYear = result.annualSummaries[0]
    expect(firstYear?.startingBalance).toBe(100000)

    // Total should be: initial - expenses + interest from both accounts
    // The exact amount depends on the proportional distribution logic
    expect(firstYear?.endingBalance).toBeLessThan(100000) // Net expenses
    expect(firstYear?.endingBalance).toBeGreaterThan(85000) // But interest partially offsets
  })

  it('should handle fixed assets separately from liquid assets', () => {
    const profile = createTestProfile({
      birthDate: '1995-01-01', // 30 years old in 2025
      capitalAccounts: [
        { id: '1', name: 'Savings', amount: 50000, assetType: 'liquid' },
        { id: '2', name: 'House', amount: 200000, annualInterestRate: 3, assetType: 'fixed' }, // 3% appreciation
      ],
      liquidAssetsInterestRate: 5,
      cashFlows: [
        {
          id: '1',
          name: 'Monthly Expense',
          monthlyAmount: 1000,
          startDate: stringToMonth('2025-01-01')!,
          type: 'expense',
        },
      ],
    })

    const result = calculateProjections(profile)
    const firstYear = result.annualSummaries[0]

    // Liquid assets should handle cash flows
    // Starting: 50000, with 5% interest and 11 months * 1000 expenses
    expect(firstYear?.endingLiquidAssets).toBeLessThan(50000) // Decreased due to expenses
    expect(firstYear?.endingLiquidAssets).toBeGreaterThan(38000) // But interest helps

    // Fixed assets should only appreciate, not affected by cash flows
    // 200000 * (1 + 0.03/12)^12 ≈ 206083
    expect(firstYear?.endingFixedAssets).toBeCloseTo(206083, 0)

    // Total should be sum of both
    expect(firstYear?.endingBalance).toBeCloseTo(
      firstYear!.endingLiquidAssets + firstYear!.endingFixedAssets,
      0,
    )
  })

  it('should handle fixed asset depreciation (negative rate)', () => {
    const profile = createTestProfile({
      birthDate: '1995-01-01', // 30 years old in 2025
      capitalAccounts: [
        { id: '1', name: 'Cash', amount: 10000, assetType: 'liquid' },
        { id: '2', name: 'Car', amount: 30000, annualInterestRate: -10, assetType: 'fixed' }, // 10% depreciation
      ],
      liquidAssetsInterestRate: 0,
      cashFlows: [],
    })

    const result = calculateProjections(profile)
    const firstYear = result.annualSummaries[0]

    // Cash should remain unchanged (no interest, no cash flows)
    expect(firstYear?.endingLiquidAssets).toBeCloseTo(10000, 0)

    // Car should depreciate: 30000 * (1 + -0.10/12)^12 ≈ 27134
    expect(firstYear?.endingFixedAssets).toBeCloseTo(27134, 0)
    expect(firstYear?.endingFixedAssets).toBeLessThan(30000) // Depreciated

    // Total net worth should decrease due to car depreciation
    expect(firstYear?.endingBalance).toBeCloseTo(37134, 0)
  })

  it('should track liquid and fixed assets separately in projections', () => {
    const profile = createTestProfile({
      birthDate: '1995-01-01', // 30 years old in 2025
      capitalAccounts: [
        { id: '1', name: 'Investment', amount: 100000, assetType: 'liquid' },
        { id: '2', name: 'Property', amount: 300000, annualInterestRate: 2, assetType: 'fixed' },
      ],
      liquidAssetsInterestRate: 7,
      cashFlows: [],
    })

    const result = calculateProjections(profile)

    // Check that every monthly projection has separate liquid and fixed asset values
    expect(result.monthlyProjections.length).toBeGreaterThan(0)
    result.monthlyProjections.forEach((projection) => {
      expect(projection.liquidAssets).toBeGreaterThan(0)
      expect(projection.fixedAssets).toBeGreaterThan(0)
      expect(projection.balance).toBe(projection.liquidAssets + projection.fixedAssets)
    })

    // Verify annual summaries also track separately
    const firstYear = result.annualSummaries[0]
    expect(firstYear?.startingLiquidAssets).toBe(100000)
    expect(firstYear?.startingFixedAssets).toBe(300000)
    expect(firstYear?.endingLiquidAssets).toBeGreaterThan(100000) // Growth from interest
    expect(firstYear?.endingFixedAssets).toBeGreaterThan(300000) // Growth from appreciation
  })

  describe('One-Time Transactions', () => {
    it('should apply one-time income only once', () => {
      const profile = createTestProfile({
        birthDate: '1995-01-01', // 30 years old in 2025
        capitalAccounts: [{ id: '1', name: 'Savings', amount: 50000, assetType: 'liquid' }],
        liquidAssetsInterestRate: 0,
        cashFlows: [],
      })

      // Manually add a one-time income (windfall) for June 2025
      const windfall = new CashFlow(
        '1',
        'Bonus',
        10000,
        'income',
        stringToMonth('2025-06-01')!,
        undefined,
        false,
        true // isOneTime
      )
      profile.cashFlows.push(windfall)

      const result = calculateProjections(profile)

      // Check first year total income - should be exactly 10000 (one-time)
      const firstYear = result.annualSummaries[0]
      expect(firstYear?.totalIncome).toBe(10000)

      // Check ending balance: starting 50000 + 10000 income = 60000
      expect(firstYear?.endingBalance).toBe(60000)

      // Check that subsequent years have no income
      const year2026 = result.annualSummaries.find((s) => s.year === 2026)
      expect(year2026?.totalIncome).toBe(0)
    })

    it('should apply one-time expense only once', () => {
      const profile = createTestProfile({
        birthDate: '1995-01-01', // 30 years old in 2025
        capitalAccounts: [{ id: '1', name: 'Savings', amount: 100000, assetType: 'liquid' }],
        liquidAssetsInterestRate: 0,
        cashFlows: [],
      })

      // Manually add a one-time expense for March 2025
      const oneTimeExpense = new CashFlow(
        '1',
        'Car Purchase',
        25000,
        'expense',
        stringToMonth('2025-03-01')!,
        undefined,
        false,
        true // isOneTime
      )
      profile.cashFlows.push(oneTimeExpense)

      const result = calculateProjections(profile)

      // Check first year total expense - should be exactly 25000 (one-time)
      const firstYear = result.annualSummaries[0]
      expect(firstYear?.totalExpenses).toBe(25000)

      // Check ending balance: starting 100000 - 25000 expense = 75000
      expect(firstYear?.endingBalance).toBe(75000)

      // Check that subsequent years have no expenses
      const year2026 = result.annualSummaries.find((s) => s.year === 2026)
      expect(year2026?.totalExpenses).toBe(0)
    })

    it('should handle multiple one-time transactions in different months', () => {
      const profile = createTestProfile({
        birthDate: '1995-01-01', // 30 years old in 2025
        capitalAccounts: [{ id: '1', name: 'Savings', amount: 100000, assetType: 'liquid' }],
        liquidAssetsInterestRate: 0,
        cashFlows: [],
      })

      // Add multiple one-time transactions
      profile.cashFlows.push(
        new CashFlow(
          '1',
          'Bonus',
          5000,
          'income',
          stringToMonth('2025-02-01')!,
          undefined,
          false,
          true
        )
      )
      profile.cashFlows.push(
        new CashFlow(
          '2',
          'Tax Refund',
          3000,
          'income',
          stringToMonth('2025-04-01')!,
          undefined,
          false,
          true
        )
      )
      profile.cashFlows.push(
        new CashFlow(
          '3',
          'Vacation',
          4000,
          'expense',
          stringToMonth('2025-07-01')!,
          undefined,
          false,
          true
        )
      )

      const result = calculateProjections(profile)

      // Check first year totals
      const firstYear = result.annualSummaries[0]
      expect(firstYear?.totalIncome).toBe(8000) // 5000 + 3000
      expect(firstYear?.totalExpenses).toBe(4000)

      // Net change: +8000 - 4000 = +4000
      expect(firstYear?.endingBalance).toBe(104000)
    })

    it('should handle mix of one-time and recurring transactions', () => {
      const profile = createTestProfile({
        birthDate: '1995-01-01', // 30 years old in 2025
        capitalAccounts: [{ id: '1', name: 'Savings', amount: 100000, assetType: 'liquid' }],
        liquidAssetsInterestRate: 0,
        cashFlows: [
          {
            id: '1',
            name: 'Salary',
            monthlyAmount: 5000,
            type: 'income',
            startDate: stringToMonth('2025-01-01')!,
          },
          {
            id: '2',
            name: 'Rent',
            monthlyAmount: 1500,
            type: 'expense',
            startDate: stringToMonth('2025-01-01')!,
          },
        ],
      })

      // Add one-time bonus
      profile.cashFlows.push(
        new CashFlow(
          '3',
          'Year-end Bonus',
          15000,
          'income',
          stringToMonth('2025-12-01')!,
          undefined,
          false,
          true
        )
      )

      const result = calculateProjections(profile)

      // Check first year
      const firstYear = result.annualSummaries[0]
      // Recurring: 12 months * 5000 = 60000, One-time: 15000
      expect(firstYear?.totalIncome).toBeCloseTo(75000, -2)
      // Recurring: 12 months * 1500 = 18000
      expect(firstYear?.totalExpenses).toBeCloseTo(18000, -2)

      // Check second year - should only have recurring, no bonus
      const year2026 = result.annualSummaries.find((s) => s.year === 2026)
      expect(year2026?.totalIncome).toBeCloseTo(60000, -2) // 12 months * 5000
      expect(year2026?.totalExpenses).toBeCloseTo(18000, -2) // 12 months * 1500
    })

    it('should apply inflation to one-time transactions based on their date', () => {
      // Add one-time transaction 5 years in the future with inflation enabled
      const futureWindfall = new CashFlow(
        '1',
        'Future Windfall',
        10000,
        'income',
        stringToMonth('2030-06-01')!,
        undefined,
        true, // followsInflation
        true // isOneTime
      )

      // Create profile with inflation rate and the future windfall
      const profile = new UserProfile(
        stringToMonth('1995-01-01')!,
        [new LiquidAsset('1', 'Savings', 100000)],
        [futureWindfall],
        0, // liquidAssetsInterestRate
        [], // debts
        3 // inflationRate
      )

      const result = calculateProjections(profile)

      // Check year 2030
      const year2030 = result.annualSummaries.find((s) => s.year === 2030)

      // After 5.5 years (66 months), amount should be: 10000 * (1.03)^5.5 ≈ 11790
      // More precisely: from Feb 2025 to Jun 2030 is about 5.4 years
      expect(year2030?.totalIncome).toBeGreaterThan(11500)
      expect(year2030?.totalIncome).toBeLessThan(12000)
    })

    it('should ignore endDate for one-time transactions', () => {
      const profile = createTestProfile({
        birthDate: '1995-01-01', // 30 years old in 2025
        capitalAccounts: [{ id: '1', name: 'Savings', amount: 50000, assetType: 'liquid' }],
        liquidAssetsInterestRate: 0,
        cashFlows: [],
      })

      // Add one-time transaction with an endDate (which should be ignored)
      const oneTime = new CashFlow(
        '1',
        'One-time Income',
        10000,
        'income',
        stringToMonth('2025-06-01')!,
        stringToMonth('2025-12-01')!, // This endDate should be ignored
        false,
        true // isOneTime
      )
      profile.cashFlows.push(oneTime)

      const result = calculateProjections(profile)

      // Should only apply once in June, not affected by December endDate
      const firstYear = result.annualSummaries[0]
      expect(firstYear?.totalIncome).toBe(10000)
    })

    it('should require startDate for one-time transactions', () => {
      // This test verifies the validation in the CashFlow constructor
      expect(() => {
        new CashFlow(
          '1',
          'Invalid One-time',
          10000,
          'income',
          undefined, // Missing startDate
          undefined,
          false,
          true // isOneTime
        )
      }).toThrow('One-time transactions must have a start date')
    })
  })

  describe('Debt Calculations', () => {
    it('should handle linear debt with fixed principal payment', () => {
      const debt = new Debt({
        name: 'Student Loan',
        amount: 10000,
        annualInterestRate: 5,
        monthlyPrincipalPayment: 500,
        startDate: stringToMonth('2025-01-01')!,
      })

      const profile = new UserProfile(
        stringToMonth('1995-01-01')!,
        [new LiquidAsset('1', 'Savings', 50000)],
        [],
        5,
        [debt],
      )

      const result = calculateProjections(profile)
      const firstYear = result.annualSummaries[0]

      // Should have debt at start
      expect(firstYear?.startingTotalDebt).toBe(10000)

      // After 12 months (Jan-Dec 2025), principal paid should be ~6000 (500 * 12)
      expect(firstYear?.totalDebtPrincipalPaid).toBeCloseTo(6000, -2)

      // Interest should be calculated on declining balance
      // Month 1: 10000 * 0.05/12 ≈ 41.67, Month 2: 9500 * 0.05/12 ≈ 39.58, etc.
      expect(firstYear?.totalDebtInterestPaid).toBeGreaterThan(0)
      expect(firstYear?.totalDebtInterestPaid).toBeLessThan(500)

      // Ending debt should be less than starting
      expect(firstYear?.endingTotalDebt).toBeLessThan(firstYear!.startingTotalDebt)
    })

    it('should handle annualized debt with fixed total payment', () => {
      const debt = new Debt({
        name: 'Car Loan',
        amount: 20000,
        annualInterestRate: 6,
        monthlyPayment: 600,
        startDate: stringToMonth('2025-01-01')!,
      })

      const profile = new UserProfile(
        stringToMonth('1995-01-01')!,
        [new LiquidAsset('1', 'Savings', 100000)],
        [],
        5,
        [debt],
      )

      const result = calculateProjections(profile)
      const firstYear = result.annualSummaries[0]

      // Should have debt at start
      expect(firstYear?.startingTotalDebt).toBe(20000)

      // Total payments should be 600 * 12 = 7200 (12 months)
      const totalPayments =
        firstYear!.totalDebtPrincipalPaid + firstYear!.totalDebtInterestPaid
      expect(totalPayments).toBeCloseTo(7200, -2)

      // Ending debt should be significantly reduced
      expect(firstYear?.endingTotalDebt).toBeLessThan(15000)
    })

    it('should handle interest-only debt', () => {
      const debt = new Debt({
        name: 'Interest-Only Mortgage',
        amount: 100000,
        annualInterestRate: 4,
        finalBalance: 0,
        startDate: stringToMonth('2025-01-01')!,
        endDate: stringToMonth('2030-01-01')!,
      })

      const profile = new UserProfile(
        stringToMonth('1995-01-01')!,
        [new LiquidAsset('1', 'Savings', 200000)],
        [],
        5,
        [debt],
      )

      const result = calculateProjections(profile)
      const firstYear = result.annualSummaries[0]

      // Should have debt at start
      expect(firstYear?.startingTotalDebt).toBe(100000)

      // No principal should be paid in first year (interest-only)
      expect(firstYear?.totalDebtPrincipalPaid).toBe(0)

      // Interest should be paid: 100000 * 0.04/12 * 12 ≈ 4000
      expect(firstYear?.totalDebtInterestPaid).toBeCloseTo(4000, -2)

      // Debt balance should remain unchanged (interest-only)
      expect(firstYear?.endingTotalDebt).toBe(100000)

      // Check that balloon payment happens at end date
      const year2030 = result.annualSummaries.find((s) => s.year === 2030)
      expect(year2030?.endingTotalDebt).toBe(0) // Should be paid off
    })

    it('should handle debt that started in the past', () => {
      // Debt started 6 months ago
      const debt = new Debt({
        name: 'Old Loan',
        amount: 12000,
        annualInterestRate: 5,
        monthlyPrincipalPayment: 500,
        startDate: stringToMonth('2024-07-01')!,
      })

      const profile = new UserProfile(
        stringToMonth('1995-01-01')!,
        [new LiquidAsset('1', 'Savings', 50000)],
        [],
        5,
        [debt],
      )

      const result = calculateProjections(profile)
      const firstYear = result.annualSummaries[0]

      // Should have calculated current balance after 6 months of payments
      // 12000 - (500 * 6) = 9000
      expect(firstYear?.startingTotalDebt).toBeCloseTo(9000, 0)

      // Not the original debt amount
      expect(firstYear?.startingTotalDebt).not.toBe(12000)
    })

    it('should handle debt with separate repayment start date', () => {
      // Debt exists but repayment hasn't started yet
      const debt = new Debt({
        name: 'Deferred Student Loan',
        amount: 15000,
        annualInterestRate: 4,
        monthlyPrincipalPayment: 300,
        startDate: stringToMonth('2024-01-01')!,
        repaymentStartDate: stringToMonth('2026-01-01')!,
      })

      const profile = new UserProfile(
        stringToMonth('1995-01-01')!,
        [new LiquidAsset('1', 'Savings', 50000)],
        [],
        5,
        [debt],
      )

      const result = calculateProjections(profile)
      const firstYear = result.annualSummaries[0]

      // Debt exists but no principal payments yet in 2025
      expect(firstYear?.startingTotalDebt).toBe(15000)
      expect(firstYear?.totalDebtPrincipalPaid).toBe(0)
      expect(firstYear?.endingTotalDebt).toBe(15000)

      // Check 2026 - payments should start
      const year2026 = result.annualSummaries.find((s) => s.year === 2026)
      expect(year2026?.totalDebtPrincipalPaid).toBeGreaterThan(0)
    })

    it('should handle debt that was partially paid off in the past', () => {
      // Debt started 12 months ago with 500/month payment
      const debt = new Debt({
        name: 'Past Loan',
        amount: 10000,
        annualInterestRate: 6,
        monthlyPrincipalPayment: 500,
        startDate: stringToMonth('2024-01-01')!,
      })

      const profile = new UserProfile(
        stringToMonth('1995-01-01')!,
        [new LiquidAsset('1', 'Savings', 50000)],
        [],
        5,
        [debt],
      )

      const result = calculateProjections(profile)
      const firstYear = result.annualSummaries[0]

      // After 12 months: 10000 - (500 * 12) = 4000
      expect(firstYear?.startingTotalDebt).toBeCloseTo(4000, 0)

      // Should be paid off within the first year since only 4000 / 500 = 8 months remain
      expect(firstYear?.endingTotalDebt).toBe(0)
    })

    it('should handle multiple debts simultaneously', () => {
      const debt1 = new Debt({
        name: 'Loan 1',
        amount: 5000,
        annualInterestRate: 5,
        monthlyPrincipalPayment: 250,
        startDate: stringToMonth('2025-01-01')!,
      })

      const debt2 = new Debt({
        name: 'Loan 2',
        amount: 8000,
        annualInterestRate: 6,
        monthlyPayment: 300,
        startDate: stringToMonth('2025-01-01')!,
      })

      const profile = new UserProfile(
        stringToMonth('1995-01-01')!,
        [new LiquidAsset('1', 'Savings', 100000)],
        [],
        5,
        [debt1, debt2],
      )

      const result = calculateProjections(profile)
      const firstYear = result.annualSummaries[0]

      // Should have both debts at start
      expect(firstYear?.startingTotalDebt).toBe(13000)

      // Both should make payments
      expect(firstYear?.totalDebtPrincipalPaid).toBeGreaterThan(0)
      expect(firstYear?.totalDebtInterestPaid).toBeGreaterThan(0)

      // Total debt should decrease
      expect(firstYear?.endingTotalDebt).toBeLessThan(firstYear!.startingTotalDebt)
    })

    it('should reduce liquid assets when making debt payments', () => {
      const debt = new Debt({
        name: 'Loan',
        amount: 10000,
        annualInterestRate: 5,
        monthlyPrincipalPayment: 500,
        startDate: stringToMonth('2025-01-01')!,
      })

      const profile = new UserProfile(
        stringToMonth('1995-01-01')!,
        [new LiquidAsset('1', 'Savings', 50000)],
        [],
        0, // No interest on liquid assets
        [debt],
      )

      const result = calculateProjections(profile)
      const firstYear = result.annualSummaries[0]

      // Liquid assets should decrease due to debt payments
      // Principal: ~5500 (500 * 11), Interest: ~250 (declining balance)
      const expectedDecrease =
        firstYear!.totalDebtPrincipalPaid + firstYear!.totalDebtInterestPaid
      expect(firstYear!.startingLiquidAssets - firstYear!.endingLiquidAssets).toBeCloseTo(
        expectedDecrease,
        -2,
      )
    })

    it('should not affect fixed assets when paying debt', () => {
      const debt = new Debt({
        name: 'Loan',
        amount: 10000,
        annualInterestRate: 5,
        monthlyPrincipalPayment: 500,
        startDate: stringToMonth('2025-01-01')!,
      })

      const profile = new UserProfile(
        stringToMonth('1995-01-01')!,
        [
          new LiquidAsset('1', 'Savings', 50000),
          new FixedAsset('2', 'House', 200000, 3),
        ],
        [],
        0,
        [debt],
      )

      const result = calculateProjections(profile)
      const firstYear = result.annualSummaries[0]

      // Fixed assets should only change due to appreciation, not debt payments
      // 200000 * (1 + 0.03/12)^12 ≈ 206083
      expect(firstYear?.endingFixedAssets).toBeCloseTo(206083, 0)
    })

    it('should calculate net worth correctly with debt', () => {
      const debt = new Debt({
        name: 'Loan',
        amount: 20000,
        annualInterestRate: 5,
        monthlyPrincipalPayment: 500,
        startDate: stringToMonth('2025-01-01')!,
      })

      const profile = new UserProfile(
        stringToMonth('1995-01-01')!,
        [new LiquidAsset('1', 'Savings', 50000)],
        [],
        5,
        [debt],
      )

      const result = calculateProjections(profile)
      const firstYear = result.annualSummaries[0]

      // Net worth = liquid assets + fixed assets - debt
      const calculatedNetWorth =
        firstYear!.endingLiquidAssets + firstYear!.endingFixedAssets - firstYear!.endingTotalDebt
      expect(firstYear?.endingBalance).toBeCloseTo(calculatedNetWorth, 0)
    })

    it('should skip debt payment if insufficient liquid assets', () => {
      const debt = new Debt({
        name: 'Large Loan',
        amount: 50000,
        annualInterestRate: 5,
        monthlyPrincipalPayment: 5000, // Very high payment
        startDate: stringToMonth('2025-01-01')!,
      })

      const profile = new UserProfile(
        stringToMonth('1995-01-01')!,
        [new LiquidAsset('1', 'Savings', 10000)], // Not enough to make payments
        [],
        0,
        [debt],
      )

      const result = calculateProjections(profile)
      const firstYear = result.annualSummaries[0]

      // Should only make 1 payment (first month) before running out of money
      expect(firstYear?.totalDebtPrincipalPaid).toBeCloseTo(5000, 0)

      // Liquid assets should have some remaining after first payment
      // 10000 - (5000 + interest) ≈ 4791
      expect(firstYear?.endingLiquidAssets).toBeGreaterThan(4000)
      expect(firstYear?.endingLiquidAssets).toBeLessThan(5000)

      // Debt should not be fully paid off (only 1 payment made)
      expect(firstYear?.endingTotalDebt).toBeCloseTo(45000, 0)
    })

    it('should handle debt with end date balloon payment', () => {
      const debt = new Debt({
        name: 'Balloon Loan',
        amount: 50000,
        annualInterestRate: 4,
        finalBalance: 30000, // Pay down to 30k, then balloon
        startDate: stringToMonth('2025-01-01')!,
        endDate: stringToMonth('2027-01-01')!,
      })

      const profile = new UserProfile(
        stringToMonth('1995-01-01')!,
        [new LiquidAsset('1', 'Savings', 100000)],
        [],
        5,
        [debt],
      )

      const result = calculateProjections(profile)

      // Check 2025: only interest payments
      const year2025 = result.annualSummaries.find((s) => s.year === 2025)
      expect(year2025?.totalDebtPrincipalPaid).toBe(0)
      expect(year2025?.endingTotalDebt).toBe(50000)

      // Check 2026: balloon payment should occur in Dec 2026 (last month before end date)
      const year2026 = result.annualSummaries.find((s) => s.year === 2026)
      expect(year2026?.endingTotalDebt).toBe(30000) // Should be at final balance after balloon payment
      expect(year2026?.totalDebtPrincipalPaid).toBeCloseTo(20000, -2) // Balloon payment: 50000 - 30000

      // Check 2027: no more payments after end date is reached
      const year2027 = result.annualSummaries.find((s) => s.year === 2027)
      expect(year2027?.startingTotalDebt).toBe(30000) // Starts at final balance
      expect(year2027?.totalDebtPrincipalPaid).toBe(0) // No principal payments
      expect(year2027?.endingTotalDebt).toBe(30000) // Remains at final balance
    })

    it('should handle debt that fully pays off mid-simulation', () => {
      const debt = new Debt({
        name: 'Short Loan',
        amount: 6000,
        annualInterestRate: 5,
        monthlyPrincipalPayment: 500,
        startDate: stringToMonth('2025-01-01')!,
      })

      const profile = new UserProfile(
        stringToMonth('1995-01-01')!,
        [new LiquidAsset('1', 'Savings', 50000)],
        [],
        5,
        [debt],
      )

      const result = calculateProjections(profile)
      const firstYear = result.annualSummaries[0]

      // Debt should be paid off in 12 months (6000 / 500 = 12 months)
      // 6000 - (500 * 12) = 0 remaining
      expect(firstYear?.endingTotalDebt).toBe(0)

      // Check 2026 has no debt
      const year2026 = result.annualSummaries.find((s) => s.year === 2026)
      expect(year2026?.startingTotalDebt).toBe(0)
      expect(year2026?.endingTotalDebt).toBe(0) // Should remain at 0
    })
  })

  describe('Fixed Asset Liquidation', () => {
    it('should transfer fixed asset value to liquid assets on liquidation date', () => {
      const profile = createTestProfile({
        birthDate: '1995-01-01', // 30 years old in 2025
        capitalAccounts: [
          { id: '1', name: 'Cash', amount: 50000, assetType: 'liquid' },
          {
            id: '2',
            name: 'House',
            amount: 300000,
            annualInterestRate: 3,
            assetType: 'fixed',
            liquidationDate: '2030-06-01' // Liquidate in June 2030
          }
        ],
        liquidAssetsInterestRate: 5,
        cashFlows: []
      })

      const result = calculateProjections(profile)

      // Check year before liquidation (2029) - house should have appreciated
      const year2029 = result.annualSummaries.find((s) => s.year === 2029)
      expect(year2029?.endingFixedAssets).toBeGreaterThan(300000) // Appreciated
      expect(year2029?.endingFixedAssets).toBeLessThan(400000)

      // Check year of liquidation (2030) - house should be liquidated
      const year2030 = result.annualSummaries.find((s) => s.year === 2030)

      // Fixed assets should be 0 at end of year (liquidated in June)
      expect(year2030?.endingFixedAssets).toBe(0)

      // Liquid assets should have increased by the house value
      // They should be > starting liquid assets + appreciation over 5 years
      expect(year2030?.endingLiquidAssets).toBeGreaterThan(300000)

      // Check year after liquidation (2031) - fixed assets remain at 0
      const year2031 = result.annualSummaries.find((s) => s.year === 2031)
      expect(year2031?.startingFixedAssets).toBe(0)
      expect(year2031?.endingFixedAssets).toBe(0)
    })

    it('should liquidate at start of specified month after appreciation', () => {
      const profile = createTestProfile({
        birthDate: '1995-01-01',
        capitalAccounts: [
          { id: '1', name: 'Cash', amount: 10000, assetType: 'liquid' },
          {
            id: '2',
            name: 'Investment Property',
            amount: 100000,
            annualInterestRate: 6, // 6% annual appreciation
            assetType: 'fixed',
            liquidationDate: '2025-12-01' // Liquidate in December 2025
          }
        ],
        liquidAssetsInterestRate: 0,
        cashFlows: []
      })

      const result = calculateProjections(profile)
      const firstYear = result.annualSummaries[0]

      // Property should appreciate for 11 months (Jan-Nov) before liquidation in Dec
      // 100000 * (1 + 0.06/12)^12 ≈ 106167
      expect(firstYear?.endingFixedAssets).toBe(0) // Liquidated

      // Liquid assets should have the appreciated value
      // Starting: 10000, Added from liquidation: ~106167
      expect(firstYear?.endingLiquidAssets).toBeCloseTo(116168, 0)
    })

    it('should handle multiple fixed assets with different liquidation dates', () => {
      const profile = createTestProfile({
        birthDate: '1995-01-01',
        capitalAccounts: [
          { id: '1', name: 'Cash', amount: 20000, assetType: 'liquid' },
          {
            id: '2',
            name: 'House',
            amount: 300000,
            annualInterestRate: 3,
            assetType: 'fixed',
            liquidationDate: '2030-01-01'
          },
          {
            id: '3',
            name: 'Car',
            amount: 30000,
            annualInterestRate: -10, // Depreciation
            assetType: 'fixed',
            liquidationDate: '2027-01-01'
          }
        ],
        liquidAssetsInterestRate: 5,
        cashFlows: []
      })

      const result = calculateProjections(profile)

      // 2026: Both assets still active
      const year2026 = result.annualSummaries.find((s) => s.year === 2026)
      expect(year2026?.endingFixedAssets).toBeGreaterThan(300000) // House appreciated, car depreciated but total > 300k

      // 2027: Car liquidated (in Jan), house still active
      const year2027 = result.annualSummaries.find((s) => s.year === 2027)
      expect(year2027?.endingFixedAssets).toBeGreaterThan(300000) // Only house remains
      expect(year2027?.endingFixedAssets).toBeLessThan(400000)

      // 2030: Both liquidated
      const year2030 = result.annualSummaries.find((s) => s.year === 2030)
      expect(year2030?.endingFixedAssets).toBe(0) // All liquidated
    })

    it('should handle fixed asset without liquidation date (never liquidates)', () => {
      const profile = createTestProfile({
        birthDate: '1995-01-01',
        capitalAccounts: [
          { id: '1', name: 'Cash', amount: 50000, assetType: 'liquid' },
          {
            id: '2',
            name: 'House',
            amount: 200000,
            annualInterestRate: 3,
            assetType: 'fixed'
            // No liquidationDate
          }
        ],
        liquidAssetsInterestRate: 5,
        cashFlows: []
      })

      const result = calculateProjections(profile)

      // Check multiple years - house should never liquidate
      const year2030 = result.annualSummaries.find((s) => s.year === 2030)
      expect(year2030?.endingFixedAssets).toBeGreaterThan(200000) // Still appreciating

      const year2050 = result.annualSummaries.find((s) => s.year === 2050)
      expect(year2050?.endingFixedAssets).toBeGreaterThan(300000) // Still appreciating

      const lastYear = result.annualSummaries[result.annualSummaries.length - 1]
      expect(lastYear?.endingFixedAssets).toBeGreaterThan(0) // Never liquidated
    })

    it('should liquidate once and remain at 0 after liquidation', () => {
      const profile = createTestProfile({
        birthDate: '1995-01-01',
        capitalAccounts: [
          { id: '1', name: 'Cash', amount: 100000, assetType: 'liquid' },
          {
            id: '2',
            name: 'Property',
            amount: 150000,
            annualInterestRate: 4,
            assetType: 'fixed',
            liquidationDate: '2028-01-01'
          }
        ],
        liquidAssetsInterestRate: 0,
        cashFlows: []
      })

      const result = calculateProjections(profile)

      // Before liquidation
      const year2027 = result.annualSummaries.find((s) => s.year === 2027)
      expect(year2027?.endingFixedAssets).toBeGreaterThan(150000)

      // Year of liquidation
      const year2028 = result.annualSummaries.find((s) => s.year === 2028)
      expect(year2028?.endingFixedAssets).toBe(0)

      // Multiple years after liquidation - should stay at 0
      const year2029 = result.annualSummaries.find((s) => s.year === 2029)
      expect(year2029?.startingFixedAssets).toBe(0)
      expect(year2029?.endingFixedAssets).toBe(0)

      const year2040 = result.annualSummaries.find((s) => s.year === 2040)
      expect(year2040?.startingFixedAssets).toBe(0)
      expect(year2040?.endingFixedAssets).toBe(0)
    })

    it('should handle deprecating asset liquidation correctly', () => {
      const profile = createTestProfile({
        birthDate: '1995-01-01',
        capitalAccounts: [
          { id: '1', name: 'Cash', amount: 50000, assetType: 'liquid' },
          {
            id: '2',
            name: 'Car',
            amount: 40000,
            annualInterestRate: -15, // Heavy depreciation
            assetType: 'fixed',
            liquidationDate: '2027-06-01'
          }
        ],
        liquidAssetsInterestRate: 0,
        cashFlows: []
      })

      const result = calculateProjections(profile)

      // Year of liquidation
      const year2027 = result.annualSummaries.find((s) => s.year === 2027)

      // Car should have depreciated significantly but still transferred
      // After ~2.5 years at -15%: 40000 * (1 - 0.15)^2.5 ≈ 26000
      expect(year2027?.endingFixedAssets).toBe(0) // Liquidated
      expect(year2027?.endingLiquidAssets).toBeGreaterThan(70000) // 50k + depreciated car value
      expect(year2027?.endingLiquidAssets).toBeLessThan(80000)
    })

    it('should correctly update net worth when liquidating', () => {
      const profile = createTestProfile({
        birthDate: '1995-01-01',
        capitalAccounts: [
          { id: '1', name: 'Cash', amount: 100000, assetType: 'liquid' },
          {
            id: '2',
            name: 'Asset',
            amount: 200000,
            annualInterestRate: 5,
            assetType: 'fixed',
            liquidationDate: '2026-01-01'
          }
        ],
        liquidAssetsInterestRate: 3,
        cashFlows: []
      })

      const result = calculateProjections(profile)

      // Before liquidation
      const year2025 = result.annualSummaries.find((s) => s.year === 2025)
      const netWorth2025 = year2025!.endingLiquidAssets + year2025!.endingFixedAssets

      // After liquidation
      const year2026 = result.annualSummaries.find((s) => s.year === 2026)

      // Net worth should continue growing (all liquid now, earning interest)
      expect(year2026?.endingBalance).toBeGreaterThan(netWorth2025)

      // Total should equal liquid assets only (fixed assets are 0)
      expect(year2026?.endingBalance).toBe(year2026!.endingLiquidAssets)
      expect(year2026?.endingFixedAssets).toBe(0)
    })
  })
})
