/**
 * Cash flow model classes
 */

import { FinancialItem } from './base'
import type { CapitalAccount } from './assets'
import type { Month } from '@/types/month'
import { stringToMonth } from '@/types/month'

export type CashFlowType = 'income' | 'expense'

/**
 * Base class for cash flows (income or expenses)
 */
export class CashFlow extends FinancialItem {
  readonly monthlyAmount: number
  readonly startDate?: Month // Optional - defaults to projection start
  readonly endDate?: Month // Optional - defaults to projection end
  readonly type: CashFlowType
  readonly followsInflation: boolean // Whether this cash flow adjusts for inflation
  readonly isOneTime: boolean // Whether this is a one-time transaction (vs recurring monthly)

  constructor(
    id: string,
    name: string,
    monthlyAmount: number,
    type: CashFlowType,
    startDate?: Month,
    endDate?: Month,
    followsInflation: boolean = false,
    isOneTime: boolean = false
  ) {
    super(id, name)

    if (monthlyAmount < 0) {
      throw new Error('CashFlow amount cannot be negative')
    }

    // Validation: one-time transactions must have a startDate
    if (isOneTime && startDate === undefined) {
      throw new Error('One-time transactions must have a start date')
    }

    this.monthlyAmount = monthlyAmount
    this.type = type
    this.startDate = startDate
    this.endDate = endDate
    this.followsInflation = followsInflation
    this.isOneTime = isOneTime
  }

  /**
   * Get annual amount
   */
  getAnnualAmount(): number {
    return this.monthlyAmount * 12
  }

  /**
   * Create a copy of this cash flow with updated properties
   */
  with(
    updates: Partial<Pick<CashFlow, 'name' | 'monthlyAmount' | 'startDate' | 'endDate' | 'type' | 'followsInflation' | 'isOneTime'>>
  ): CashFlow {
    return new CashFlow(
      this.id,
      updates.name ?? this.name,
      updates.monthlyAmount ?? this.monthlyAmount,
      updates.type ?? this.type,
      updates.startDate !== undefined ? updates.startDate : this.startDate,
      updates.endDate !== undefined ? updates.endDate : this.endDate,
      updates.followsInflation ?? this.followsInflation,
      updates.isOneTime ?? this.isOneTime
    )
  }

  /**
   * Serialize to JSON for storage
   */
  toJSON(): Record<string, unknown> {
    return {
      id: this.id,
      name: this.name,
      monthlyAmount: this.monthlyAmount,
      startDate: this.startDate,
      endDate: this.endDate,
      type: this.type,
      followsInflation: this.followsInflation,
      isOneTime: this.isOneTime,
    }
  }

  /**
   * Deserialize from JSON
   */
  static fromJSON(data: any): CashFlow {
    // Handle startDate - could be Month (number), legacy string, or undefined
    let startDate: Month | undefined
    if (typeof data.startDate === 'number') {
      startDate = data.startDate
    } else if (typeof data.startDate === 'string') {
      startDate = stringToMonth(data.startDate)
    }

    // Handle endDate - could be Month (number), legacy string, or undefined
    let endDate: Month | undefined
    if (typeof data.endDate === 'number') {
      endDate = data.endDate
    } else if (typeof data.endDate === 'string') {
      endDate = stringToMonth(data.endDate)
    }

    return new CashFlow(
      data.id || crypto.randomUUID(),
      data.name || '',
      data.monthlyAmount || 0,
      data.type || 'expense',
      startDate,
      endDate,
      data.followsInflation ?? false,
      data.isOneTime ?? false
    )
  }

  /**
   * Type guard: check if an item is a CashFlow
   */
  static isCashFlow(item: CapitalAccount | CashFlow): item is CashFlow {
    return item instanceof CashFlow
  }
}

// Legacy alias for backwards compatibility during migration
export type Expense = CashFlow

// Convenience type guard function
export function isCashFlow(item: CapitalAccount | CashFlow): item is CashFlow {
  return item instanceof CashFlow
}
