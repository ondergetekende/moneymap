/**
 * Financial planner models
 *
 * This module exports all model classes and types used in the financial planner application.
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
export {
  CashFlow,
  isCashFlow,
  type CashFlowType,
  type Expense, // Legacy alias
} from './cashflow'

// Profile and projection models
export {
  UserProfile,
  type MonthlyProjection,
  type AnnualSummary,
  type ProjectionResult,
} from './profile'

// Combined type guard for convenience
import { LiquidAsset as LiquidAssetClass, FixedAsset as FixedAssetClass } from './assets'
import type { CapitalAccount } from './assets'
import type { CashFlow as CashFlowType } from './cashflow'
export function isAsset(item: CapitalAccount | CashFlowType): item is CapitalAccount {
  return item instanceof LiquidAssetClass || item instanceof FixedAssetClass
}
