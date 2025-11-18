/**
 * User profile model
 */

import type { CapitalAccount } from './assets'
import { LiquidAsset, FixedAsset } from './assets'
import { CashFlow } from './cashflow'
import { Debt } from './debt'
import type { Month } from '@/types/month'
import { getCurrentMonth, monthDiff, stringToMonth } from '@/types/month'

/**
 * User's complete financial profile
 */
export class UserProfile {
  readonly birthDate: Month // Birth month (months since January 1900)
  readonly capitalAccounts: CapitalAccount[]
  readonly cashFlows: CashFlow[]
  readonly debts: Debt[]
  readonly liquidAssetsInterestRate: number // Shared annual interest rate for all liquid assets (percentage)
  readonly inflationRate: number // Annual inflation rate (percentage)

  constructor(
    birthDate: Month,
    capitalAccounts: CapitalAccount[],
    cashFlows: CashFlow[],
    liquidAssetsInterestRate: number,
    debts: Debt[] = [],
    inflationRate: number = 2.5
  ) {
    if (birthDate === undefined || typeof birthDate !== 'number') {
      throw new Error('UserProfile birthDate must be a valid Month value')
    }

    this.birthDate = birthDate
    this.capitalAccounts = capitalAccounts
    this.cashFlows = cashFlows
    this.debts = debts
    this.liquidAssetsInterestRate = liquidAssetsInterestRate
    this.inflationRate = inflationRate
  }

  /**
   * Calculate user's age at a specific month
   */
  getAgeAt(month: Month): number {
    const monthsSinceBirth = monthDiff(month, this.birthDate)
    return Math.floor(monthsSinceBirth / 12)
  }

  /**
   * Calculate user's current age
   */
  getCurrentAge(): number {
    return this.getAgeAt(getCurrentMonth())
  }

  /**
   * Get total capital across all accounts
   */
  getTotalCapital(): number {
    return this.capitalAccounts.reduce((sum, account) => sum + account.amount, 0)
  }

  /**
   * Get total liquid assets
   */
  getTotalLiquidAssets(): number {
    return this.capitalAccounts
      .filter(LiquidAsset.isLiquidAsset)
      .reduce((sum, account) => sum + account.amount, 0)
  }

  /**
   * Get total fixed assets
   */
  getTotalFixedAssets(): number {
    return this.capitalAccounts
      .filter(FixedAsset.isFixedAsset)
      .reduce((sum, account) => sum + account.amount, 0)
  }

  /**
   * Get total debt
   */
  getTotalDebt(): number {
    return this.debts.reduce((sum, debt) => sum + debt.amount, 0)
  }

  /**
   * Create a copy of this profile with updated properties
   */
  with(updates: {
    birthDate?: Month
    capitalAccounts?: CapitalAccount[]
    cashFlows?: CashFlow[]
    debts?: Debt[]
    liquidAssetsInterestRate?: number
    inflationRate?: number
  }): UserProfile {
    return new UserProfile(
      updates.birthDate ?? this.birthDate,
      updates.capitalAccounts ?? this.capitalAccounts,
      updates.cashFlows ?? this.cashFlows,
      updates.liquidAssetsInterestRate ?? this.liquidAssetsInterestRate,
      updates.debts ?? this.debts,
      updates.inflationRate ?? this.inflationRate
    )
  }

  /**
   * Serialize to JSON for storage
   */
  toJSON(): Record<string, unknown> {
    return {
      birthDate: this.birthDate,
      capitalAccounts: this.capitalAccounts.map((acc) => acc.toJSON()),
      cashFlows: this.cashFlows.map((cf) => cf.toJSON()),
      debts: this.debts.map((debt) => debt.toJSON()),
      liquidAssetsInterestRate: this.liquidAssetsInterestRate,
      inflationRate: this.inflationRate,
    }
  }

  /**
   * Deserialize from JSON
   */
  static fromJSON(data: any): UserProfile {
    // Handle legacy data without assetType field
    const capitalAccounts = (data.capitalAccounts || []).map((acc: any) => {
      // Determine asset type
      const assetType = acc.assetType || (acc.annualInterestRate !== undefined ? 'fixed' : 'liquid')

      if (assetType === 'fixed') {
        return FixedAsset.fromJSON(acc)
      } else {
        return LiquidAsset.fromJSON(acc)
      }
    })

    const cashFlows = (data.cashFlows || []).map((cf: any) => CashFlow.fromJSON(cf))

    // Handle backward compatibility - default to empty array if debts not present
    const debts = (data.debts || []).map((debt: any) => Debt.fromJSON(debt))

    // Handle birthDate - could be Month (number) or legacy string
    let birthDate: Month
    if (typeof data.birthDate === 'number') {
      birthDate = data.birthDate
    } else if (typeof data.birthDate === 'string') {
      // Legacy string date - convert to Month
      birthDate = stringToMonth(data.birthDate) ?? getCurrentMonth()
    } else {
      // No birthDate - use current month
      birthDate = getCurrentMonth()
    }

    return new UserProfile(
      birthDate,
      capitalAccounts,
      cashFlows,
      data.liquidAssetsInterestRate || 0,
      debts,
      data.inflationRate ?? 2.5 // Default to 2.5% for backward compatibility
    )
  }
}

/**
 * Monthly projection result (read-only data structure)
 */
export interface MonthlyProjection {
  date: string // ISO date string (YYYY-MM)
  age: number
  balance: number
  liquidAssets: number
  fixedAssets: number
  totalDebt: number
  income: number
  expenses: number
  debtInterestPaid: number
  debtPrincipalPaid: number
}

/**
 * Annual summary result (read-only data structure)
 */
export interface AnnualSummary {
  year: number
  age: number // Age at start of year
  startingBalance: number
  startingLiquidAssets: number
  startingFixedAssets: number
  startingTotalDebt: number
  totalIncome: number
  totalExpenses: number
  totalDebtInterestPaid: number
  totalDebtPrincipalPaid: number
  endingBalance: number
  endingLiquidAssets: number
  endingFixedAssets: number
  endingTotalDebt: number
}

/**
 * Projection calculation result (read-only data structure)
 */
export interface ProjectionResult {
  monthlyProjections: MonthlyProjection[]
  annualSummaries: AnnualSummary[]
  calculationTimeMs: number
}
