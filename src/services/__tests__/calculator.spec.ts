import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { calculateProjections } from '../calculator'
import type { UserProfile, CashFlow } from '@/types/models'

describe('Financial Calculator', () => {
  beforeEach(() => {
    // Mock current date to 2025-01-01
    vi.setSystemTime(new Date('2025-01-01'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should calculate projections correctly', () => {
    const profile: UserProfile = {
      birthDate: '1995-01-01', // 30 years old in 2025
      capitalAccounts: [{ id: '1', name: 'Savings', amount: 100000, annualInterestRate: 0 }],
      cashFlows: [
        {
          id: '1',
          name: 'Rent',
          monthlyAmount: 1000,
          startDate: '2025-01-01',
          endDate: '2060-01-01',
          type: 'expense',
        },
        {
          id: '2',
          name: 'Food',
          monthlyAmount: 500,
          startDate: '2025-01-01',
          endDate: '2095-01-01',
          type: 'expense',
        },
      ],
    }

    const result = calculateProjections(profile)

    expect(result.monthlyProjections.length).toBeGreaterThan(0)
    expect(result.annualSummaries.length).toBeGreaterThan(0)
    expect(result.annualSummaries[0]?.year).toBe(2025)
    expect(result.annualSummaries[0]?.age).toBe(30)
    expect(result.annualSummaries[0]?.startingBalance).toBe(100000)
  })

  it('should handle expenses with different date ranges', () => {
    const profile: UserProfile = {
      birthDate: '2000-01-01', // 25 years old in 2025
      capitalAccounts: [{ id: '1', name: 'Savings', amount: 50000, annualInterestRate: 0 }],
      cashFlows: [
        {
          id: '1',
          name: 'Rent',
          monthlyAmount: 1000,
          startDate: '2025-01-01',
          endDate: '2030-01-01',
          type: 'expense',
        },
        {
          id: '2',
          name: 'Retirement',
          monthlyAmount: 500,
          startDate: '2060-01-01',
          endDate: '2095-01-01',
          type: 'expense',
        },
      ],
    }

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
    const cashFlows: CashFlow[] = []
    for (let i = 0; i < 25; i++) {
      cashFlows.push({
        id: `cashflow-${i}`,
        name: `Expense ${i}`,
        monthlyAmount: 100 + i * 10,
        startDate: `${2025 + (i % 30)}-01-01`,
        endDate: `${2055 + (i % 40)}-01-01`,
        type: 'expense',
      })
    }

    const profile: UserProfile = {
      birthDate: '1995-01-01', // 30 years old in 2025
      capitalAccounts: [{ id: '1', name: 'Savings', amount: 500000, annualInterestRate: 0 }],
      cashFlows,
    }

    const result = calculateProjections(profile)

    // Performance requirement: < 300ms
    expect(result.calculationTimeMs).toBeLessThan(300)
    expect(result.annualSummaries.length).toBeGreaterThan(0)
  })

  it('should handle multiple capital accounts', () => {
    const profile: UserProfile = {
      birthDate: '1990-01-01', // 35 years old in 2025
      capitalAccounts: [
        { id: '1', name: 'Checking', amount: 10000, annualInterestRate: 0 },
        { id: '2', name: 'Savings', amount: 50000, annualInterestRate: 0 },
        { id: '3', name: 'Investment', amount: 100000, annualInterestRate: 0 },
      ],
      cashFlows: [
        {
          id: '1',
          name: 'Living',
          monthlyAmount: 2000,
          startDate: '2025-01-01',
          endDate: '2095-01-01',
          type: 'expense',
        },
      ],
    }

    const result = calculateProjections(profile)

    // Should start with total of all accounts
    expect(result.annualSummaries[0]?.startingBalance).toBe(160000)
  })

  it('should handle negative balances correctly', () => {
    const profile: UserProfile = {
      birthDate: '1995-01-01', // 30 years old in 2025
      capitalAccounts: [{ id: '1', name: 'Savings', amount: 10000, annualInterestRate: 0 }],
      cashFlows: [
        {
          id: '1',
          name: 'High Expense',
          monthlyAmount: 5000,
          startDate: '2025-01-01',
          endDate: '2095-01-01',
          type: 'expense',
        },
      ],
    }

    const result = calculateProjections(profile)

    // Should go negative after initial capital is exhausted
    const laterYear = result.annualSummaries.find((s) => s.year === 2027)
    expect(laterYear?.endingBalance).toBeLessThan(0)
  })

  it('should calculate age correctly', () => {
    const profile: UserProfile = {
      birthDate: '1990-05-15',
      capitalAccounts: [{ id: '1', name: 'Savings', amount: 10000, annualInterestRate: 0 }],
      cashFlows: [],
    }

    const result = calculateProjections(profile)

    // In 2025-01-01 (mocked date), person born 1990-05-15 is 34 (hasn't had birthday yet)
    const firstYear = result.annualSummaries[0]
    expect(firstYear?.age).toBe(34)
  })

  it('should handle income correctly', () => {
    const profile: UserProfile = {
      birthDate: '1995-01-01', // 30 years old in 2025
      capitalAccounts: [{ id: '1', name: 'Savings', amount: 50000, annualInterestRate: 0 }],
      cashFlows: [
        {
          id: '1',
          name: 'Salary',
          monthlyAmount: 5000,
          startDate: '2025-01-01',
          endDate: '2060-01-01',
          type: 'income',
        },
        {
          id: '2',
          name: 'Rent',
          monthlyAmount: 1500,
          startDate: '2025-01-01',
          endDate: '2060-01-01',
          type: 'expense',
        },
      ],
    }

    const result = calculateProjections(profile)

    // Check first year has both income and expenses
    const firstYear = result.annualSummaries[0]
    expect(firstYear?.totalIncome).toBeCloseTo(55000, -2) // ~11 months of income (5000 * 11)
    expect(firstYear?.totalExpenses).toBeCloseTo(16500, -2) // ~11 months of expenses (1500 * 11)

    // Balance should grow since income > expenses
    if (firstYear) {
      expect(firstYear.endingBalance).toBeGreaterThan(firstYear.startingBalance)
    }
  })

  it('should handle mixed income and expenses', () => {
    const profile: UserProfile = {
      birthDate: '1990-01-01', // 35 years old in 2025
      capitalAccounts: [{ id: '1', name: 'Checking', amount: 20000, annualInterestRate: 0 }],
      cashFlows: [
        {
          id: '1',
          name: 'Job Salary',
          monthlyAmount: 6000,
          startDate: '2025-01-01',
          endDate: '2055-01-01',
          type: 'income',
        },
        {
          id: '2',
          name: 'Pension',
          monthlyAmount: 3000,
          startDate: '2055-01-01',
          endDate: '2095-01-01',
          type: 'income',
        },
        {
          id: '3',
          name: 'Rent',
          monthlyAmount: 2000,
          startDate: '2025-01-01',
          endDate: '2095-01-01',
          type: 'expense',
        },
        {
          id: '4',
          name: 'Food',
          monthlyAmount: 800,
          startDate: '2025-01-01',
          endDate: '2095-01-01',
          type: 'expense',
        },
      ],
    }

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
    const profile: UserProfile = {
      birthDate: '1995-01-01', // 30 years old in 2025
      capitalAccounts: [{ id: '1', name: 'Savings', amount: 100000, annualInterestRate: 0 }],
      cashFlows: [
        { id: '1', name: 'Rent', monthlyAmount: 1000, endDate: '2030-01-01', type: 'expense' },
        // No startDate - should be active immediately
      ],
    }

    const result = calculateProjections(profile)

    // First year should have rent expense
    const firstYear = result.annualSummaries[0]
    expect(firstYear?.totalExpenses).toBeGreaterThan(10000)

    // After 2030, should have no expenses
    const afterExpense = result.annualSummaries.find((s) => s.year === 2031)
    expect(afterExpense?.totalExpenses).toBe(0)
  })

  it('should handle cash flows with no end date (active forever)', () => {
    const profile: UserProfile = {
      birthDate: '1995-01-01', // 30 years old in 2025
      capitalAccounts: [{ id: '1', name: 'Savings', amount: 500000, annualInterestRate: 0 }],
      cashFlows: [
        {
          id: '1',
          name: 'Basic Living',
          monthlyAmount: 1500,
          startDate: '2025-01-01',
          type: 'expense',
        },
        // No endDate - should continue forever
      ],
    }

    const result = calculateProjections(profile)

    // First year should have expenses
    const firstYear = result.annualSummaries[0]
    expect(firstYear?.totalExpenses).toBeCloseTo(16500, -2) // ~11 months

    // Last year (near age 100) should also have expenses
    const lastYear = result.annualSummaries[result.annualSummaries.length - 1]
    expect(lastYear?.totalExpenses).toBeCloseTo(18000, -2) // 12 months
  })

  it('should handle cash flows with neither start nor end date (always active)', () => {
    const profile: UserProfile = {
      birthDate: '1995-01-01', // 30 years old in 2025
      capitalAccounts: [{ id: '1', name: 'Savings', amount: 300000, annualInterestRate: 0 }],
      cashFlows: [
        { id: '1', name: 'Universal Basic Income', monthlyAmount: 1000, type: 'income' },
        // No dates - always active
      ],
    }

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
    const profile: UserProfile = {
      birthDate: '1995-01-01', // 30 years old in 2025
      capitalAccounts: [{ id: '1', name: 'Savings', amount: 200000, annualInterestRate: 0 }],
      cashFlows: [
        { id: '1', name: 'Permanent Expense', monthlyAmount: 500, type: 'expense' }, // No dates
        {
          id: '2',
          name: 'Early Expense',
          monthlyAmount: 300,
          endDate: '2030-01-01',
          type: 'expense',
        }, // Only end
        {
          id: '3',
          name: 'Late Expense',
          monthlyAmount: 400,
          startDate: '2060-01-01',
          type: 'expense',
        }, // Only start
        {
          id: '4',
          name: 'Fixed Period',
          monthlyAmount: 200,
          startDate: '2040-01-01',
          endDate: '2050-01-01',
          type: 'expense',
        }, // Both dates
      ],
    }

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
    const profile: UserProfile = {
      birthDate: '1995-01-01', // 30 years old in 2025
      capitalAccounts: [{ id: '1', name: 'Investment', amount: 100000, annualInterestRate: 5 }],
      cashFlows: [], // No cash flows, only interest
    }

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
    const profile: UserProfile = {
      birthDate: '1990-01-01', // 35 years old in 2025
      capitalAccounts: [
        { id: '1', name: 'Checking', amount: 10000, annualInterestRate: 0 }, // No interest
        { id: '2', name: 'Savings', amount: 50000, annualInterestRate: 2 }, // 2% interest
        { id: '3', name: 'Investment', amount: 40000, annualInterestRate: 7 }, // 7% interest
      ],
      cashFlows: [],
    }

    const result = calculateProjections(profile)

    // Total starting: 100000
    // After 1 year:
    // - Checking: 10000 (no interest)
    // - Savings: 50000 * (1 + 0.02/12)^12 ≈ 51009
    // - Investment: 40000 * (1 + 0.07/12)^12 ≈ 42892
    // Total: ≈ 103901
    const firstYear = result.annualSummaries[0]
    expect(firstYear?.startingBalance).toBe(100000)
    expect(firstYear?.endingBalance).toBeCloseTo(103901, 0)
  })

  it('should apply interest before applying cash flows', () => {
    const profile: UserProfile = {
      birthDate: '1995-01-01', // 30 years old in 2025
      capitalAccounts: [{ id: '1', name: 'Investment', amount: 100000, annualInterestRate: 5 }],
      cashFlows: [
        {
          id: '1',
          name: 'Monthly Contribution',
          monthlyAmount: 1000,
          startDate: '2025-01-01',
          type: 'income',
        },
      ],
    }

    const result = calculateProjections(profile)

    // After 1 year with monthly contributions and compound interest
    // Each month: apply interest first, then add income
    // Starting in Jan 2025, we get contributions and compound interest over the year
    // Result should be ~116348 (11 months of contributions + compound interest)
    const firstYear = result.annualSummaries[0]
    expect(firstYear?.totalIncome).toBeCloseTo(11000, -2) // 11 months of 1000
    expect(firstYear?.endingBalance).toBeCloseTo(116348, 0) // Principal + interest + contributions
  })

  it('should handle negative balances with interest correctly', () => {
    const profile: UserProfile = {
      birthDate: '1995-01-01', // 30 years old in 2025
      capitalAccounts: [{ id: '1', name: 'Account', amount: 10000, annualInterestRate: 5 }],
      cashFlows: [
        {
          id: '1',
          name: 'Large Expense',
          monthlyAmount: 2000,
          startDate: '2025-01-01',
          type: 'expense',
        },
      ],
    }

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
    const profile: UserProfile = {
      birthDate: '1995-01-01', // 30 years old in 2025
      capitalAccounts: [
        { id: '1', name: 'Low Rate', amount: 50000, annualInterestRate: 1 },
        { id: '2', name: 'High Rate', amount: 50000, annualInterestRate: 10 },
      ],
      cashFlows: [
        {
          id: '1',
          name: 'Expense',
          monthlyAmount: 1000,
          startDate: '2025-01-01',
          type: 'expense',
        },
      ],
    }

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
})
