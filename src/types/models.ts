/**
 * Data models for the Financial Planner application
 */

export type AssetType = 'liquid' | 'fixed'

export interface CapitalAccount {
  id: string
  name: string
  amount: number
  annualInterestRate?: number // Annual interest rate as percentage (e.g., 5 for 5%)
  assetType: AssetType // 'liquid' for cash/investments, 'fixed' for property/vehicles
}           

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
