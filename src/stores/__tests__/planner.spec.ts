import { setActivePinia, createPinia } from 'pinia'
import { describe, beforeEach, it, expect, vi } from 'vitest'
import { nextTick } from 'vue'
import { usePlannerStore } from '../planner'
import { Debt } from '@/models'
import { storageService } from '@/services/storage'
import { calculateProjections } from '@/services/calculator'
import type { ProjectionResult } from '@/models'
import { getCurrentMonth, addMonths } from '@/types/month'

// Mock the services
vi.mock('@/services/storage')
vi.mock('@/services/calculator')

const mockProjectionResult = {
  monthlyProjections: [],
  annualSummaries: [],
  itemProjections: [],
  calculationTimeMs: 0,
} as ProjectionResult

describe('Planner Store', () => {
  beforeEach(() => {
    // Create a new Pinia instance for each test
    const pinia = createPinia()
    setActivePinia(pinia)
    vi.clearAllMocks()
  })

  describe('State initialization', () => {
    it('should initialize with default values', () => {
      const store = usePlannerStore()
      expect(store.birthDate).toBeDefined()
      expect(store.capitalAccounts).toEqual([])
      expect(store.cashFlows).toEqual([])
      expect(store.debts).toEqual([])
      expect(store.inflationRate).toBe(3)
      expect(store.liquidAssetsInterestRate).toBe(7)
      expect(store.wizardCompleted).toBe(false)
      expect(store.showWizard).toBe(false)
    })
  })

  describe('Settings Actions', () => {
    it('should set birth date and recalculate', () => {
      const store = usePlannerStore()
      const newBirthDate = addMonths(getCurrentMonth(), -120) // 10 years ago

      // Mock calculateProjections to avoid real calculation
      vi.mocked(calculateProjections).mockReturnValue(mockProjectionResult)

      store.setBirthDate(newBirthDate)

      expect(store.birthDate).toBe(newBirthDate)
      expect(calculateProjections).toHaveBeenCalled()
    })

    it('should set inflation rate and recalculate', () => {
      const store = usePlannerStore()
      vi.mocked(calculateProjections).mockReturnValue(mockProjectionResult)

      store.setInflationRate(5)
      expect(store.inflationRate).toBe(5)
      expect(calculateProjections).toHaveBeenCalled()
    })

    it('should set tax country and recalculate', () => {
      const store = usePlannerStore()
      vi.mocked(calculateProjections).mockReturnValue(mockProjectionResult)

      store.setTaxCountry('NL')
      expect(store.taxCountry).toBe('NL')
      expect(calculateProjections).toHaveBeenCalled()
    })
  })

  describe('Wizard Actions', () => {
    it('should open wizard and set default life events if first time', () => {
      const store = usePlannerStore()
      store.openWizard()

      expect(store.showWizard).toBe(true)
      expect(store.lifeEvents.length).toBe(2)
      expect(store.lifeEvents[0]!.name).toBe('Retirement')
      expect(store.lifeEvents[1]!.name).toBe('Life expectancy')
    })

    it('should close wizard', () => {
      const store = usePlannerStore()
      store.openWizard()
      store.closeWizard()
      expect(store.showWizard).toBe(false)
    })

    it('should complete wizard', () => {
      const store = usePlannerStore()
      store.openWizard()
      store.completeWizard()
      expect(store.wizardCompleted).toBe(true)
      expect(store.showWizard).toBe(false)
    })
  })

  describe('Financial Item Actions', () => {
    it('clears routing settings when their account is removed', () => {
      const store = usePlannerStore()
      vi.mocked(calculateProjections).mockReturnValue(mockProjectionResult)
      store.addCapitalAccount({ type: 'liquid', name: 'Savings', amount: 1000 })
      const accountId = store.capitalAccounts[0]!.id
      store.setPrimaryAccountId(accountId)
      store.addCashFlow({
        name: 'Income',
        amount: 100,
        type: 'income',
        followsInflation: false,
        isOneTime: false,
        frequency: 'monthly',
        accountId,
      })
      store.addDebt(
        new Debt({ id: 'loan', name: 'Loan', amount: 100, annualInterestRate: 0, accountId }),
      )

      store.removeCapitalAccount(accountId)

      expect(store.primaryAccountId).toBeUndefined()
      expect(store.cashFlows[0]!.accountId).toBeUndefined()
      expect(store.debts[0]!.accountId).toBeUndefined()
    })

    it('clears optional account and interest overrides', () => {
      const store = usePlannerStore()
      vi.mocked(calculateProjections).mockReturnValue(mockProjectionResult)
      store.addCapitalAccount({
        type: 'liquid',
        name: 'Savings',
        amount: 1000,
        annualInterestRate: 3,
      })
      const accountId = store.capitalAccounts[0]!.id
      store.addCashFlow({
        name: 'Income',
        amount: 100,
        type: 'income',
        followsInflation: false,
        isOneTime: false,
        frequency: 'monthly',
        accountId,
      })
      store.addDebt(
        new Debt({ id: 'loan', name: 'Loan', amount: 100, annualInterestRate: 0, accountId }),
      )

      store.updateCapitalAccount(accountId, { annualInterestRate: undefined })
      store.updateCashFlow(store.cashFlows[0]!.id, { accountId: undefined })
      store.updateDebt('loan', { accountId: undefined })

      expect(store.capitalAccounts[0]!.annualInterestRate).toBeUndefined()
      expect(store.cashFlows[0]!.accountId).toBeUndefined()
      expect(store.debts[0]!.accountId).toBeUndefined()
    })

    it('should add a liquid asset', () => {
      const store = usePlannerStore()
      vi.mocked(calculateProjections).mockReturnValue(mockProjectionResult)

      store.addCapitalAccount({
        type: 'liquid',
        name: 'Savings Account',
        amount: 5000,
      })

      expect(store.capitalAccounts.length).toBe(1)
      expect(store.capitalAccounts[0]!.name).toBe('Savings Account')
      expect(store.capitalAccounts[0]!.amount).toBe(5000)
      expect(calculateProjections).toHaveBeenCalled()
    })

    it('should add a fixed asset', () => {
      const store = usePlannerStore()
      vi.mocked(calculateProjections).mockReturnValue(mockProjectionResult)

      store.addCapitalAccount({
        type: 'fixed',
        name: 'House',
        amount: 300000,
        annualInterestRate: 2,
      })

      expect(store.capitalAccounts.length).toBe(1)
      expect(store.capitalAccounts[0]!.name).toBe('House')
      expect(store.capitalAccounts[0]!.amount).toBe(300000)
      expect(calculateProjections).toHaveBeenCalled()
    })

    it('should remove a capital account', () => {
      const store = usePlannerStore()
      vi.mocked(calculateProjections).mockReturnValue(mockProjectionResult)

      store.addCapitalAccount({
        type: 'liquid',
        name: 'Disposable',
        amount: 100,
      })
      const account = store.capitalAccounts[0]
      if (!account) throw new Error('Expected account to exist')
      const id = account.id

      store.removeCapitalAccount(id)
      expect(store.capitalAccounts.length).toBe(0)
    })

    it('should add a cash flow', () => {
      const store = usePlannerStore()
      vi.mocked(calculateProjections).mockReturnValue(mockProjectionResult)

      store.addCashFlow({
        name: 'Salary',
        amount: 3000,
        type: 'income',
        followsInflation: true,
        isOneTime: false,
        frequency: 'monthly',
      })

      expect(store.cashFlows.length).toBe(1)
      expect(store.cashFlows[0]!.name).toBe('Salary')
      expect(store.cashFlows[0]!.amount).toBe(3000)
      expect(calculateProjections).toHaveBeenCalled()
    })

    it('should add a debt', () => {
      const store = usePlannerStore()
      vi.mocked(calculateProjections).mockReturnValue(mockProjectionResult)

      const debt = new Debt({
        id: 'd1',
        name: 'Loan',
        amount: 10000,
        annualInterestRate: 1000,
      })
      store.addDebt(debt)

      expect(store.debts.length).toBe(1)
      expect(store.debts[0]!.id).toBe('d1')
      expect(calculateProjections).toHaveBeenCalled()
    })
  })

  describe('Storage Actions', () => {
    it('should call saveToStorage', () => {
      const store = usePlannerStore()
      store.saveToStorage()
      expect(storageService.saveProfile).toHaveBeenCalled()
      expect(storageService.saveWizardCompleted).toHaveBeenCalled()
    })

    it('auto-saves when only the tax country changes', async () => {
      const store = usePlannerStore()
      store.setTaxCountry('NL')
      await nextTick()
      expect(storageService.saveProfile).toHaveBeenCalledWith(
        expect.objectContaining({ taxCountry: 'NL' }),
      )
    })

    it('auto-saves when only a life event is added', async () => {
      const store = usePlannerStore()
      store.addLifeEvent({ name: 'House purchase' })
      await nextTick()
      expect(storageService.saveProfile).toHaveBeenCalledWith(
        expect.objectContaining({
          lifeEvents: [expect.objectContaining({ name: 'House purchase' })],
        }),
      )
    })

    it('auto-saves when the wizard is completed', async () => {
      const store = usePlannerStore()
      store.completeWizard()
      await nextTick()
      expect(storageService.saveWizardCompleted).toHaveBeenCalledWith(true)
    })

    it('should clear all data', () => {
      const store = usePlannerStore()
      store.setPrimaryAccountId('account')
      store.clearAll()

      expect(store.capitalAccounts).toEqual([])
      expect(store.cashFlows).toEqual([])
      expect(store.debts).toEqual([])
      expect(store.lifeEvents).toEqual([])
      expect(store.primaryAccountId).toBeUndefined()
      expect(storageService.clearProfile).toHaveBeenCalled()
      expect(storageService.clearWizardCompleted).toHaveBeenCalled()
    })
  })
})
