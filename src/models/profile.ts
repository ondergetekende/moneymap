/**
 * User profile model
 */

import type { CapitalAccount } from './assets'
import { LiquidAsset, FixedAsset } from './assets'
import { CashFlow } from './cashflow'

/**
 * User's complete financial profile
 */
export class UserProfile {
  readonly birthDate: string // ISO date string (YYYY-MM-DD)
  readonly capitalAccounts: CapitalAccount[]
  readonly cashFlows: CashFlow[]
  readonly liquidAssetsInterestRate: number // Shared annual interest rate for all liquid assets (percentage)

  constructor(
    birthDate: string,
    capitalAccounts: CapitalAccount[],
    cashFlows: CashFlow[],
    liquidAssetsInterestRate: number
  ) {
    if (!birthDate || !this.isValidDate(birthDate)) {
      throw new Error('UserProfile birthDate must be a valid ISO date string (YYYY-MM-DD)')
    }

    this.birthDate = birthDate
    this.capitalAccounts = capitalAccounts
    this.cashFlows = cashFlows
    this.liquidAssetsInterestRate = liquidAssetsInterestRate
  }

  /**
   * Validate ISO date string format
   */
  private isValidDate(dateString: string): boolean {
    const regex = /^\d{4}-\d{2}-\d{2}$/
    if (!regex.test(dateString)) return false
    const date = new Date(dateString)
    return !isNaN(date.getTime())
  }

  /**
   * Calculate user's age at a specific date
   */
  getAgeAt(date: Date): number {
    const birth = new Date(this.birthDate)
    let age = date.getFullYear() - birth.getFullYear()
    const monthDiff = date.getMonth() - birth.getMonth()
    if (monthDiff < 0 || (monthDiff === 0 && date.getDate() < birth.getDate())) {
      age--
    }
    return age
  }

  /**
   * Calculate user's current age
   */
  getCurrentAge(): number {
    return this.getAgeAt(new Date())
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
   * Create a copy of this profile with updated properties
   */
  with(updates: {
    birthDate?: string
    capitalAccounts?: CapitalAccount[]
    cashFlows?: CashFlow[]
    liquidAssetsInterestRate?: number
  }): UserProfile {
    return new UserProfile(
      updates.birthDate ?? this.birthDate,
      updates.capitalAccounts ?? this.capitalAccounts,
      updates.cashFlows ?? this.cashFlows,
      updates.liquidAssetsInterestRate ?? this.liquidAssetsInterestRate
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
      liquidAssetsInterestRate: this.liquidAssetsInterestRate,
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

    return new UserProfile(
      data.birthDate || new Date().toISOString().split('T')[0],
      capitalAccounts,
      cashFlows,
      data.liquidAssetsInterestRate || 0
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
  income: number
  expenses: number
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
  totalIncome: number
  totalExpenses: number
  endingBalance: number
  endingLiquidAssets: number
  endingFixedAssets: number
}

/**
 * Projection calculation result (read-only data structure)
 */
export interface ProjectionResult {
  monthlyProjections: MonthlyProjection[]
  annualSummaries: AnnualSummary[]
  calculationTimeMs: number
}
