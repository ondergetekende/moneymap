/**
 * Cash flow model classes
 */

import { FinancialItem } from './base'
import type { CapitalAccount } from './assets'
import type { Month } from '@/types/month'
import { stringToMonth } from '@/types/month'

export type CashFlowType = 'income' | 'expense'
export type CashFlowFrequency = 'weekly' | 'monthly' | 'annual'

/**
 * Base class for cash flows (income or expenses)
 */
export class CashFlow extends FinancialItem {
  readonly amount: number // The amount in the frequency specified
  readonly startDate?: Month // Optional - defaults to projection start
  readonly endDate?: Month // Optional - defaults to projection end
  readonly type: CashFlowType
  readonly followsInflation: boolean // Whether this cash flow adjusts for inflation
  readonly isOneTime: boolean // Whether this is a one-time transaction (vs recurring monthly)
  readonly incomeTaxId?: string // Tax treatment for income: tax option ID, 'after-tax', 'default', or undefined
  readonly frequency: CashFlowFrequency // The frequency that amount represents

  constructor(
    id: string,
    name: string,
    amount: number,
    type: CashFlowType,
    startDate?: Month,
    endDate?: Month,
    followsInflation: boolean = false,
    isOneTime: boolean = false,
    incomeTaxId?: string,
    frequency: CashFlowFrequency = 'monthly'
  ) {
    super(id, name)

    if (amount < 0) {
      throw new Error('CashFlow amount cannot be negative')
    }

    // Validation: one-time transactions must have a startDate
    if (isOneTime && startDate === undefined) {
      throw new Error('One-time transactions must have a start date')
    }

    this.amount = amount
    this.type = type
    this.startDate = startDate
    this.endDate = endDate
    this.followsInflation = followsInflation
    this.isOneTime = isOneTime
    this.incomeTaxId = incomeTaxId
    this.frequency = frequency
  }

  /**
   * Get the weekly amount
   */
  get weeklyAmount(): number {
    switch (this.frequency) {
      case 'weekly':
        return this.amount
      case 'monthly':
        // Monthly to weekly: multiply by 12 months, divide by 52 weeks
        return this.amount * 12 / 52
      case 'annual':
        // Annual to weekly: divide by 52 weeks
        return this.amount / 52
    }
  }

  /**
   * Get the monthly amount for calculations
   */
  get monthlyAmount(): number {
    switch (this.frequency) {
      case 'weekly':
        // Weekly to monthly: multiply by 52 weeks/year, divide by 12 months
        return this.amount * 52 / 12
      case 'monthly':
        return this.amount
      case 'annual':
        // Annual to monthly: divide by 12
        return this.amount / 12
    }
  }

  /**
   * Get the annual amount
   */
  get annualAmount(): number {
    switch (this.frequency) {
      case 'weekly':
        // Weekly to annual: multiply by 52 weeks/year
        return this.amount * 52
      case 'monthly':
        // Monthly to annual: multiply by 12
        return this.amount * 12
      case 'annual':
        return this.amount
    }
  }

  /**
   * Create a copy of this cash flow with updated properties
   */
  with(
    updates: Partial<Pick<CashFlow, 'name' | 'amount' | 'startDate' | 'endDate' | 'type' | 'followsInflation' | 'isOneTime' | 'incomeTaxId' | 'frequency'>>
  ): CashFlow {
    return new CashFlow(
      this.id,
      updates.name ?? this.name,
      updates.amount ?? this.amount,
      updates.type ?? this.type,
      updates.startDate !== undefined ? updates.startDate : this.startDate,
      updates.endDate !== undefined ? updates.endDate : this.endDate,
      updates.followsInflation ?? this.followsInflation,
      updates.isOneTime ?? this.isOneTime,
      updates.incomeTaxId !== undefined ? updates.incomeTaxId : this.incomeTaxId,
      updates.frequency ?? this.frequency
    )
  }

  /**
   * Serialize to JSON for storage
   */
  toJSON(): Record<string, unknown> {
    return {
      id: this.id,
      name: this.name,
      amount: this.amount,
      startDate: this.startDate,
      endDate: this.endDate,
      type: this.type,
      followsInflation: this.followsInflation,
      isOneTime: this.isOneTime,
      incomeTaxId: this.incomeTaxId,
      frequency: this.frequency,
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

    // Handle backward compatibility: old data has 'monthlyAmount', new data has 'amount'
    let amount = data.amount
    let frequency = data.frequency ?? 'monthly'

    // If amount is missing but monthlyAmount exists (old format), convert it
    if (amount === undefined && data.monthlyAmount !== undefined) {
      // Old data stored monthlyAmount regardless of frequency
      // We need to keep the amount as-is but store it in the 'amount' field
      amount = data.monthlyAmount
    }

    return new CashFlow(
      data.id || crypto.randomUUID(),
      data.name || '',
      amount || 0,
      data.type || 'expense',
      startDate,
      endDate,
      data.followsInflation ?? false,
      data.isOneTime ?? false,
      data.incomeTaxId, // Optional, undefined if not present for backward compatibility
      frequency
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
