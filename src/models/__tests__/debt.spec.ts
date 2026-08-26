import { describe, it, expect } from 'vitest'
import { Debt } from '../debt'

describe('Debt', () => {
  describe('specificationMode round-trip', () => {
    it('preserves specificationMode "endDate" for an annuity debt', () => {
      const debt = new Debt({
        name: 'Mortgage',
        amount: 200000,
        annualInterestRate: 3.5,
        endDate: { type: 'absolute', month: 1500 },
        monthlyPayment: 900, // calculated from end date
        specificationMode: 'endDate',
      })

      const restored = Debt.fromJSON(debt.toJSON())

      expect(restored.specificationMode).toBe('endDate')
    })

    it('preserves specificationMode "amount" when user specified the payment', () => {
      const debt = new Debt({
        name: 'Mortgage',
        amount: 200000,
        annualInterestRate: 3.5,
        endDate: { type: 'absolute', month: 1500 },
        monthlyPayment: 900,
        specificationMode: 'amount',
      })

      const restored = Debt.fromJSON(debt.toJSON())

      expect(restored.specificationMode).toBe('amount')
    })

    it('preserves specificationMode for a linear debt', () => {
      const debt = new Debt({
        name: 'Car loan',
        amount: 30000,
        annualInterestRate: 4,
        endDate: { type: 'absolute', month: 1450 },
        monthlyPrincipalPayment: 500, // calculated from end date
        specificationMode: 'endDate',
      })

      const restored = Debt.fromJSON(debt.toJSON())

      expect(restored.specificationMode).toBe('endDate')
    })
  })
})
