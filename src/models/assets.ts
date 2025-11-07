/**
 * Asset model classes
 */

import { FinancialItem } from './base'

export type AssetType = 'liquid' | 'fixed'

/**
 * Base class for liquid assets (savings accounts, checking accounts, etc.)
 */
export class LiquidAsset extends FinancialItem {
  readonly amount: number

  constructor(id: string, name: string, amount: number) {
    super(id, name)

    if (amount < 0) {
      throw new Error('LiquidAsset amount cannot be negative')
    }

    this.amount = amount
  }

  /**
   * Create a copy of this asset with updated properties
   */
  with(updates: Partial<Pick<LiquidAsset, 'name' | 'amount'>>): LiquidAsset {
    return new LiquidAsset(
      this.id,
      updates.name ?? this.name,
      updates.amount ?? this.amount
    )
  }

  /**
   * Serialize to JSON for storage
   * Keep assetType for backward compatibility with existing localStorage data
   */
  toJSON(): Record<string, unknown> {
    return {
      id: this.id,
      name: this.name,
      amount: this.amount,
      assetType: 'liquid', // For backward compatibility
    }
  }

  /**
   * Deserialize from JSON
   */
  static fromJSON(data: any): LiquidAsset {
    return new LiquidAsset(
      data.id || crypto.randomUUID(),
      data.name || '',
      data.amount || 0
    )
  }

  /**
   * Type guard: check if an account is a LiquidAsset using instanceof
   */
  static isLiquidAsset(account: CapitalAccount): account is LiquidAsset {
    return account instanceof LiquidAsset
  }
}

/**
 * Base class for fixed assets (property, cars, etc.) with appreciation/depreciation
 */
export class FixedAsset extends FinancialItem {
  readonly amount: number
  readonly annualInterestRate: number // Annual appreciation/depreciation rate as percentage (e.g., 3 for 3%, -10 for -10%)

  constructor(id: string, name: string, amount: number, annualInterestRate: number) {
    super(id, name)

    if (amount < 0) {
      throw new Error('FixedAsset amount cannot be negative')
    }

    this.amount = amount
    this.annualInterestRate = annualInterestRate
  }

  /**
   * Create a copy of this asset with updated properties
   */
  with(updates: Partial<Pick<FixedAsset, 'name' | 'amount' | 'annualInterestRate'>>): FixedAsset {
    return new FixedAsset(
      this.id,
      updates.name ?? this.name,
      updates.amount ?? this.amount,
      updates.annualInterestRate ?? this.annualInterestRate
    )
  }

  /**
   * Serialize to JSON for storage
   * Keep assetType for backward compatibility with existing localStorage data
   */
  toJSON(): Record<string, unknown> {
    return {
      id: this.id,
      name: this.name,
      amount: this.amount,
      annualInterestRate: this.annualInterestRate,
      assetType: 'fixed', // For backward compatibility
    }
  }

  /**
   * Deserialize from JSON
   */
  static fromJSON(data: any): FixedAsset {
    return new FixedAsset(
      data.id || crypto.randomUUID(),
      data.name || '',
      data.amount || 0,
      data.annualInterestRate || 0
    )
  }

  /**
   * Type guard: check if an account is a FixedAsset using instanceof
   */
  static isFixedAsset(account: CapitalAccount): account is FixedAsset {
    return account instanceof FixedAsset
  }
}

export type CapitalAccount = LiquidAsset | FixedAsset

// Convenience type guard functions
export function isLiquidAsset(account: CapitalAccount): account is LiquidAsset {
  return account instanceof LiquidAsset
}

export function isFixedAsset(account: CapitalAccount): account is FixedAsset {
  return account instanceof FixedAsset
}
