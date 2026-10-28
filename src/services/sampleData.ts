/**
 * Default plan for new users. The wizard uses it, and the landing page shows it as an example.
 */

import { UserProfile, LiquidAsset, CashFlow, type LifeEvent } from '@/models'
import { getCurrentMonth, addMonths } from '@/types/month'

export const DEFAULT_INTEREST_RATE = 7
export const DEFAULT_INFLATION_RATE = 3

export function createDefaultBirthDate() {
  return addMonths(getCurrentMonth(), -30 * 12)
}

export function createDefaultLifeEvents(): LifeEvent[] {
  return [
    {
      id: crypto.randomUUID(),
      name: 'Retirement',
      date: { type: 'age', age: 67 },
      description: 'Default retirement life event',
    },
    {
      id: crypto.randomUUID(),
      name: 'Life expectancy',
      date: { type: 'age', age: 90 },
      description: 'Expected life span',
    },
  ]
}

export function createDefaultItems(retirementEventId?: string) {
  const retirement = retirementEventId
    ? { type: 'lifeEvent' as const, eventId: retirementEventId }
    : undefined
  const monthly = (
    name: string,
    amount: number,
    type: 'income' | 'expense',
    start?: typeof retirement,
    end?: typeof retirement,
  ) =>
    new CashFlow(
      crypto.randomUUID(),
      name,
      amount,
      type,
      start,
      end,
      true,
      false,
      undefined,
      'monthly',
    )

  return {
    capitalAccounts: [new LiquidAsset(crypto.randomUUID(), 'Savings', 10000, undefined, undefined)],
    cashFlows: [
      monthly('Salary', 2500, 'income', undefined, retirement),
      monthly('Pension', 1500, 'income', retirement, undefined),
      monthly('Living expenses', 1500, 'expense'),
    ],
  }
}

export function createSampleProfile(): UserProfile {
  const lifeEvents = createDefaultLifeEvents()
  const { capitalAccounts, cashFlows } = createDefaultItems(lifeEvents[0]!.id)
  return new UserProfile(
    createDefaultBirthDate(),
    capitalAccounts,
    cashFlows,
    DEFAULT_INTEREST_RATE,
    [],
    DEFAULT_INFLATION_RATE,
    undefined,
    lifeEvents,
  )
}
