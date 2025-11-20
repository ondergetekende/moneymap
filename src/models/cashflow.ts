/**
 * Cash flow model classes
 */

import { FinancialItem } from './base'
import type { CapitalAccount } from './assets'
import type { DateSpecification } from '@/types/month'
import { stringToMonth, createAbsoluteDate } from '@/types/month'

export type CashFlowType = 'income' | 'expense'
export type CashFlowFrequency = 'weekly' | 'monthly' | 'annual'

/**
 * Base class for cash flows (income or expenses)
 */
export class CashFlow extends FinancialItem {
  readonly amount: number // The amount in the frequency specified
  readonly startDate?: DateSpecification // Optional - defaults to projection start
  readonly endDate?: DateSpecification // Optional - defaults to projection end
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
    startDate?: DateSpecification,
    endDate?: DateSpecification,
    followsInflation: boolean = false,
    isOneTime: boolean = false,
    incomeTaxId?: string,
    frequency: CashFlowFrequency = 'monthly',
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
        return (this.amount * 12) / 52
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
        return (this.amount * 52) / 12
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
    updates: Partial<
      Pick<
        CashFlow,
        | 'name'
        | 'amount'
        | 'startDate'
        | 'endDate'
        | 'type'
        | 'followsInflation'
        | 'isOneTime'
        | 'incomeTaxId'
        | 'frequency'
      >
    >,
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
      updates.frequency ?? this.frequency,
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
  static fromJSON(data: Record<string, unknown>): CashFlow {
    // Handle startDate - migrate old Month (number) to DateSpecification
    let startDate: DateSpecification | undefined
    if (data.startDate !== undefined && data.startDate !== null) {
      if (typeof data.startDate === 'number') {
        // Migrate old format: wrap Month as absolute DateSpecification
        startDate = createAbsoluteDate(data.startDate)
      } else if (typeof data.startDate === 'string') {
        // Legacy string format
        const month = stringToMonth(data.startDate)
        if (month !== undefined) {
          startDate = createAbsoluteDate(month)
        }
      } else if (typeof data.startDate === 'object') {
        // New format: already a DateSpecification
        startDate = data.startDate as DateSpecification
      }
    }

    // Handle endDate - migrate old Month (number) to DateSpecification
    let endDate: DateSpecification | undefined
    if (data.endDate !== undefined && data.endDate !== null) {
      if (typeof data.endDate === 'number') {
        // Migrate old format: wrap Month as absolute DateSpecification
        endDate = createAbsoluteDate(data.endDate)
      } else if (typeof data.endDate === 'string') {
        // Legacy string format
        const month = stringToMonth(data.endDate)
        if (month !== undefined) {
          endDate = createAbsoluteDate(month)
        }
      } else if (typeof data.endDate === 'object') {
        // New format: already a DateSpecification
        endDate = data.endDate as DateSpecification
      }
    }

    // Handle backward compatibility: old data has 'monthlyAmount', new data has 'amount'
    let amount = data.amount as number | undefined
    const frequency = (data.frequency as CashFlow['frequency']) ?? 'monthly'

    // If amount is missing but monthlyAmount exists (old format), convert it
    if (amount === undefined && data.monthlyAmount !== undefined) {
      // Old data stored monthlyAmount regardless of frequency
      // We need to keep the amount as-is but store it in the 'amount' field
      amount = data.monthlyAmount as number
    }

    return new CashFlow(
      (data.id as string) || crypto.randomUUID(),
      (data.name as string) || '',
      amount || 0,
      (data.type as 'income' | 'expense') || 'expense',
      startDate,
      endDate,
      (data.followsInflation as boolean) ?? false,
      (data.isOneTime as boolean) ?? false,
      data.incomeTaxId as string | undefined, // Optional, undefined if not present for backward compatibility
      frequency,
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
