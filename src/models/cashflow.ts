/**
 * Cash flow model classes
 */

import { FinancialItem } from './base'
import type { CapitalAccount } from './assets'

export type CashFlowType = 'income' | 'expense'

/**
 * Base class for cash flows (income or expenses)
 */
export class CashFlow extends FinancialItem {
  readonly monthlyAmount: number
  readonly startDate?: string // ISO date string (YYYY-MM-DD), optional - defaults to projection start
  readonly endDate?: string // ISO date string (YYYY-MM-DD), optional - defaults to projection end
  readonly type: CashFlowType

  constructor(
    id: string,
    name: string,
    monthlyAmount: number,
    type: CashFlowType,
    startDate?: string,
    endDate?: string
  ) {
    super(id, name)

    if (monthlyAmount < 0) {
      throw new Error('CashFlow amount cannot be negative')
    }
    if (startDate && !this.isValidDate(startDate)) {
      throw new Error('CashFlow startDate must be a valid ISO date string (YYYY-MM-DD)')
    }
    if (endDate && !this.isValidDate(endDate)) {
      throw new Error('CashFlow endDate must be a valid ISO date string (YYYY-MM-DD)')
    }

    this.monthlyAmount = monthlyAmount
    this.type = type
    this.startDate = startDate
    this.endDate = endDate
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
   * Get annual amount
   */
  getAnnualAmount(): number {
    return this.monthlyAmount * 12
  }

  /**
   * Create a copy of this cash flow with updated properties
   */
  with(
    updates: Partial<Pick<CashFlow, 'name' | 'monthlyAmount' | 'startDate' | 'endDate' | 'type'>>
  ): CashFlow {
    return new CashFlow(
      this.id,
      updates.name ?? this.name,
      updates.monthlyAmount ?? this.monthlyAmount,
      updates.type ?? this.type,
      updates.startDate ?? this.startDate,
      updates.endDate ?? this.endDate
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
    }
  }

  /**
   * Deserialize from JSON
   */
  static fromJSON(data: any): CashFlow {
    return new CashFlow(
      data.id || crypto.randomUUID(),
      data.name || '',
      data.monthlyAmount || 0,
      data.type || 'expense',
      data.startDate,
      data.endDate
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
