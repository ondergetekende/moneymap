import { FinancialItem } from './base'
import type { Month, DateSpecification } from '@/types/month'
import { stringToMonth, createAbsoluteDate } from '@/types/month'

/**
 * Payment breakdown for a single month
 */
export interface DebtPayment {
  principal: number
  interest: number
  totalPayment: number
}

/**
 * Unified debt class supporting three repayment strategies:
 * - Linear: Fixed principal payment (monthlyPrincipalPayment)
 * - Annualized: Fixed total payment (monthlyPayment)
 * - Interest-only: Only interest paid until end (finalBalance)
 */
export class Debt extends FinancialItem {
  readonly amount: number
  readonly annualInterestRate: number
  readonly startDate?: DateSpecification
  readonly repaymentStartDate?: DateSpecification
  readonly endDate?: DateSpecification

  // Payment strategy fields - only one should be set
  readonly monthlyPrincipalPayment?: number // Linear
  readonly monthlyPayment?: number // Annualized
  readonly finalBalance?: number // Interest-only

  constructor(data: {
    id?: string
    name: string
    amount: number
    annualInterestRate: number
    startDate?: DateSpecification
    repaymentStartDate?: DateSpecification
    endDate?: DateSpecification
    monthlyPrincipalPayment?: number
    monthlyPayment?: number
    finalBalance?: number
  }) {
    super(data.id || crypto.randomUUID(), data.name)
    this.amount = data.amount
    this.annualInterestRate = data.annualInterestRate
    this.startDate = data.startDate
    this.repaymentStartDate = data.repaymentStartDate
    this.endDate = data.endDate
    this.monthlyPrincipalPayment = data.monthlyPrincipalPayment
    this.monthlyPayment = data.monthlyPayment
    this.finalBalance = data.finalBalance
  }

  /**
   * Get discriminator type based on which payment field is set
   */
  getDebtType(): 'linear' | 'annualized' | 'interest-only' {
    if (this.monthlyPrincipalPayment !== undefined) return 'linear'
    if (this.monthlyPayment !== undefined) return 'annualized'
    return 'interest-only'
  }

  /**
   * Calculate payment for current month based on remaining balance
   */
  calculateMonthlyPayment(currentBalance: number, monthsRemaining?: number): DebtPayment {
    const interest = this.getMonthlyInterest(currentBalance)

    // Linear: fixed principal payment
    if (this.monthlyPrincipalPayment !== undefined) {
      const principal = Math.min(this.monthlyPrincipalPayment, currentBalance)
      return {
        principal,
        interest,
        totalPayment: principal + interest,
      }
    }

    // Annualized: fixed total payment
    if (this.monthlyPayment !== undefined) {
      const principal = Math.min(this.monthlyPayment - interest, currentBalance)
      return {
        principal: Math.max(0, principal),
        interest,
        totalPayment: this.monthlyPayment,
      }
    }

    // Interest-only: balloon payment at end
    if (monthsRemaining !== undefined && monthsRemaining <= 1) {
      const balloonPayment = Math.max(0, currentBalance - (this.finalBalance ?? 0))
      return {
        principal: balloonPayment,
        interest,
        totalPayment: balloonPayment + interest,
      }
    }

    return {
      principal: 0,
      interest,
      totalPayment: interest,
    }
  }

  /**
   * Calculate projected balance after specified number of months
   */
  calculateProjectedBalance(initialBalance: number, months: number): number {
    let balance = initialBalance

    // Interest-only: balance stays constant (no principal payments during the term)
    if (this.monthlyPrincipalPayment === undefined && this.monthlyPayment === undefined) {
      return initialBalance
    }

    // Linear or Annualized: iterate through payments
    for (let i = 0; i < months; i++) {
      const payment = this.calculateMonthlyPayment(balance)
      balance -= payment.principal
      if (balance <= 0) return 0
    }
    return balance
  }

  /**
   * Validate payment settings and return warnings
   */
  validatePaymentSettings(): string[] {
    const warnings: string[] = []
    const minInterest = this.getMonthlyInterest(this.amount)

    // Linear validation
    if (this.monthlyPrincipalPayment !== undefined) {
      if (this.monthlyPrincipalPayment <= 0) {
        warnings.push('Monthly principal payment must be greater than 0')
      }
      if (this.monthlyPrincipalPayment < minInterest * 0.1) {
        warnings.push(
          `Monthly principal payment is very low. Minimum interest is €${minInterest.toFixed(2)}/month`,
        )
      }
    }

    // Annualized validation
    if (this.monthlyPayment !== undefined) {
      if (this.monthlyPayment <= 0) {
        warnings.push('Monthly payment must be greater than 0')
      }
      if (this.monthlyPayment <= minInterest) {
        warnings.push(
          `Monthly payment (€${this.monthlyPayment.toFixed(2)}) must be greater than minimum interest (€${minInterest.toFixed(2)}) to pay off debt`,
        )
      }
    }

    // Interest-only validation
    if (this.monthlyPrincipalPayment === undefined && this.monthlyPayment === undefined) {
      if (this.finalBalance !== undefined && this.finalBalance < 0) {
        warnings.push('Final balance cannot be negative')
      }
      if (this.finalBalance !== undefined && this.finalBalance > this.amount) {
        warnings.push('Final balance cannot exceed initial debt amount')
      }
      if (!this.endDate && (this.finalBalance ?? 0) < this.amount) {
        warnings.push(
          'Interest-only debt without end date will never be paid off (no end date specified)',
        )
      }
    }

    return warnings
  }

  /**
   * Check if debt exists at this month
   * Note: This method now requires resolved dates - call from calculator with resolved dates
   */
  isActive(month: Month, resolvedStartDate?: Month, resolvedEndDate?: Month): boolean {
    if (resolvedStartDate !== undefined) {
      if (month < resolvedStartDate) return false
    }
    if (resolvedEndDate !== undefined) {
      if (month > resolvedEndDate) return false
    }
    return true
  }

  /**
   * Check if repayments should occur at this month
   * Note: This method now requires resolved dates - call from calculator with resolved dates
   */
  isRepaymentActive(
    month: Month,
    resolvedStartDate?: Month,
    resolvedRepaymentStartDate?: Month,
    resolvedEndDate?: Month,
  ): boolean {
    if (!this.isActive(month, resolvedStartDate, resolvedEndDate)) return false

    const repaymentStart = resolvedRepaymentStartDate ?? resolvedStartDate

    if (repaymentStart !== undefined && month < repaymentStart) return false

    return true
  }

  /**
   * Calculate monthly interest for given balance
   */
  getMonthlyInterest(balance: number): number {
    return balance * (this.annualInterestRate / 100 / 12)
  }

  /**
   * Create a copy with updated properties
   */
  with(
    updates: Partial<{
      name: string
      amount: number
      annualInterestRate: number
      startDate: DateSpecification | undefined
      repaymentStartDate: DateSpecification | undefined
      endDate: DateSpecification | undefined
      monthlyPrincipalPayment: number | undefined
      monthlyPayment: number | undefined
      finalBalance: number | undefined
    }>,
  ): Debt {
    return new Debt({
      id: this.id,
      name: updates.name ?? this.name,
      amount: updates.amount ?? this.amount,
      annualInterestRate: updates.annualInterestRate ?? this.annualInterestRate,
      startDate: updates.startDate !== undefined ? updates.startDate : this.startDate,
      repaymentStartDate:
        updates.repaymentStartDate !== undefined
          ? updates.repaymentStartDate
          : this.repaymentStartDate,
      endDate: updates.endDate !== undefined ? updates.endDate : this.endDate,
      monthlyPrincipalPayment:
        updates.monthlyPrincipalPayment !== undefined
          ? updates.monthlyPrincipalPayment
          : this.monthlyPrincipalPayment,
      monthlyPayment:
        updates.monthlyPayment !== undefined ? updates.monthlyPayment : this.monthlyPayment,
      finalBalance: updates.finalBalance !== undefined ? updates.finalBalance : this.finalBalance,
    })
  }

  /**
   * Serialize to JSON with discriminator
   */
  toJSON(): Record<string, unknown> {
    return {
      id: this.id,
      name: this.name,
      amount: this.amount,
      annualInterestRate: this.annualInterestRate,
      startDate: this.startDate,
      repaymentStartDate: this.repaymentStartDate,
      endDate: this.endDate,
      type: this.getDebtType(),
      monthlyPrincipalPayment: this.monthlyPrincipalPayment,
      monthlyPayment: this.monthlyPayment,
      finalBalance: this.finalBalance,
    }
  }

  /**
   * Deserialize from JSON
   */
  static fromJSON(data: Record<string, unknown>): Debt {
    // Handle startDate - migrate old Month (number) to DateSpecification
    let startDate: DateSpecification | undefined
    if (data.startDate !== undefined && data.startDate !== null) {
      if (typeof data.startDate === 'number') {
        startDate = createAbsoluteDate(data.startDate)
      } else if (typeof data.startDate === 'string') {
        const month = stringToMonth(data.startDate)
        if (month !== undefined) {
          startDate = createAbsoluteDate(month)
        }
      } else if (typeof data.startDate === 'object') {
        startDate = data.startDate as DateSpecification
      }
    }

    // Handle repaymentStartDate - migrate old Month (number) to DateSpecification
    let repaymentStartDate: DateSpecification | undefined
    if (data.repaymentStartDate !== undefined && data.repaymentStartDate !== null) {
      if (typeof data.repaymentStartDate === 'number') {
        repaymentStartDate = createAbsoluteDate(data.repaymentStartDate)
      } else if (typeof data.repaymentStartDate === 'string') {
        const month = stringToMonth(data.repaymentStartDate)
        if (month !== undefined) {
          repaymentStartDate = createAbsoluteDate(month)
        }
      } else if (typeof data.repaymentStartDate === 'object') {
        repaymentStartDate = data.repaymentStartDate as DateSpecification
      }
    }

    // Handle endDate - migrate old Month (number) to DateSpecification
    let endDate: DateSpecification | undefined
    if (data.endDate !== undefined && data.endDate !== null) {
      if (typeof data.endDate === 'number') {
        endDate = createAbsoluteDate(data.endDate)
      } else if (typeof data.endDate === 'string') {
        const month = stringToMonth(data.endDate)
        if (month !== undefined) {
          endDate = createAbsoluteDate(month)
        }
      } else if (typeof data.endDate === 'object') {
        endDate = data.endDate as DateSpecification
      }
    }

    return new Debt({
      id: data.id as string,
      name: data.name as string,
      amount: data.amount as number,
      annualInterestRate: data.annualInterestRate as number,
      startDate,
      repaymentStartDate,
      endDate,
      monthlyPrincipalPayment: data.monthlyPrincipalPayment as number | undefined,
      monthlyPayment: data.monthlyPayment as number | undefined,
      finalBalance: data.finalBalance as number | undefined,
    })
  }

  /**
   * Type guard for Debt instances
   */
  static isDebt(item: unknown): item is Debt {
    return item instanceof Debt
  }
}

// Keep legacy type aliases for backward compatibility
export const LinearDebt = Debt
export const AnnualizedDebt = Debt
export const InterestOnlyDebt = Debt
