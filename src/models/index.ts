/**
 * MoneyMap models
 *
 * This module exports all model classes and types used in the MoneyMap application.
 */

// Base class
export { FinancialItem } from './base'

// Asset models
export {
  LiquidAsset,
  FixedAsset,
  isLiquidAsset,
  isFixedAsset,
  type AssetType,
  type CapitalAccount,
} from './assets'

// Cash flow models
export { CashFlow, isCashFlow, type CashFlowType, type CashFlowFrequency } from './cashflow'

// Debt models
import { Debt as DebtClass } from './debt'
export { Debt, type DebtPayment } from './debt'

// Type guard for debt
export function isDebt(item: unknown): item is DebtClass {
  return DebtClass.isDebt(item)
}

// Profile and projection models
export {
  UserProfile,
  type LifeEvent,
  type MonthlyProjection,
  type AnnualSummary,
  type ItemMonthlySnapshot,
  type ItemProjection,
  type ProjectionResult,
} from './profile'

// Combined type guard for convenience
import { LiquidAsset as LiquidAssetClass, FixedAsset as FixedAssetClass } from './assets'
import type { CapitalAccount } from './assets'
import type { CashFlow as CashFlowType } from './cashflow'
export function isAsset(item: CapitalAccount | CashFlowType): item is CapitalAccount {
  return item instanceof LiquidAssetClass || item instanceof FixedAssetClass
}
