/**
 * Data models for the Financial Planner application
 */

export interface LiquidAsset {
  id: string
  name: string
  amount: number
  assetType: 'liquid'
}

export interface FixedAsset {
  id: string
  name: string
  amount: number
  annualInterestRate: number // Annual appreciation/depreciation rate as percentage (e.g., 3 for 3%, -10 for -10%)
  assetType: 'fixed'
}

export type CapitalAccount = LiquidAsset | FixedAsset

export type AssetType = 'liquid' | 'fixed'

export type CashFlowType = 'income' | 'expense'

export interface CashFlow {
  id: string
  name: string
  monthlyAmount: number
  startDate?: string // ISO date string (YYYY-MM-DD), optional - defaults to projection start
  endDate?: string // ISO date string (YYYY-MM-DD), optional - defaults to projection end
  type: CashFlowType
}

// Legacy alias for backwards compatibility during migration
export type Expense = CashFlow

export interface UserProfile {
  birthDate: string // ISO date string (YYYY-MM-DD)
  capitalAccounts: CapitalAccount[]
  cashFlows: CashFlow[]
  liquidAssetsInterestRate: number // Shared annual interest rate for all liquid assets (percentage)
}

export interface MonthlyProjection {
  date: string // ISO date string (YYYY-MM)
  age: number
  balance: number
  liquidAssets: number
  fixedAssets: number
  income: number
  expenses: number
}

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

export interface ProjectionResult {
  monthlyProjections: MonthlyProjection[]
  annualSummaries: AnnualSummary[]
  calculationTimeMs: number
}
