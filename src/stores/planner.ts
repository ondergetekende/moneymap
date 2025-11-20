/**
 * Pinia store for MoneyMap state management
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  UserProfile,
  LiquidAsset,
  FixedAsset,
  CashFlow,
  type CapitalAccount,
  type ProjectionResult,
  type AllDebtTypes,
  type CashFlowType,
  type CashFlowFrequency,
  type LifeEvent,
} from '@/models'
import { storageService } from '@/services/storage'
import { calculateProjections } from '@/services/calculator'
import type { Month, DateSpecification } from '@/types/month'
import { getCurrentMonth, addMonths, createAbsoluteDate } from '@/types/month'

export const usePlannerStore = defineStore('planner', () => {
  // State
  // Default to 30 years ago (30 * 12 months = 360 months)
  const birthDate = ref<Month>(addMonths(getCurrentMonth(), -360))
  const capitalAccounts = ref<CapitalAccount[]>([])
  const cashFlows = ref<CashFlow[]>([])
  const debts = ref<AllDebtTypes[]>([])
  const lifeEvents = ref<LifeEvent[]>([])
  const liquidAssetsInterestRate = ref<number>(7) // Default 7% for all liquid assets (moderate)
  const inflationRate = ref<number>(3) // Default 3% inflation (moderate)
  const taxCountry = ref<string | undefined>(undefined) // ISO country code for tax calculations
  const projectionResult = ref<ProjectionResult | null>(null)

  // Wizard state
  const wizardCompleted = ref<boolean>(false) // Track if user has completed wizard at least once
  const showWizard = ref<boolean>(false) // Control wizard modal visibility

  // Computed
  const userProfile = computed<UserProfile>(() => {
    return new UserProfile(
      birthDate.value,
      capitalAccounts.value as CapitalAccount[],
      cashFlows.value as CashFlow[],
      liquidAssetsInterestRate.value,
      debts.value as AllDebtTypes[],
      inflationRate.value,
      taxCountry.value,
      lifeEvents.value,
    )
  })

  const currentAge = computed(() => {
    return userProfile.value.getCurrentAge()
  })

  const totalCapital = computed(() =>
    capitalAccounts.value.reduce((sum, account) => sum + account.amount, 0),
  )

  const hasData = computed(
    () => capitalAccounts.value.length > 0 || cashFlows.value.length > 0 || debts.value.length > 0,
  )

  // New computed properties for unified list
  const allItems = computed(() => {
    return [...capitalAccounts.value, ...cashFlows.value, ...debts.value] as (
      | CapitalAccount
      | CashFlow
      | AllDebtTypes
    )[]
  })

  const totalAssets = computed(() =>
    capitalAccounts.value.reduce((sum, account) => sum + account.amount, 0),
  )

  const totalIncome = computed(() =>
    cashFlows.value
      .filter((cf) => cf.type === 'income')
      .reduce((sum, cf) => sum + cf.annualAmount, 0),
  )

  const totalExpenses = computed(() =>
    cashFlows.value
      .filter((cf) => cf.type === 'expense')
      .reduce((sum, cf) => sum + cf.annualAmount, 0),
  )

  const totalDebt = computed(() =>
    debts.value.reduce((sum: number, debt: AllDebtTypes) => sum + debt.amount, 0),
  )

  // Actions
  function setBirthDate(month: Month) {
    birthDate.value = month
    recalculate()
  }

  function setLiquidAssetsInterestRate(rate: number) {
    liquidAssetsInterestRate.value = rate
    recalculate()
  }

  function setInflationRate(rate: number) {
    inflationRate.value = rate
    recalculate()
  }

  function setTaxCountry(country: string | undefined) {
    taxCountry.value = country
    recalculate()
  }

  function openWizard() {
    showWizard.value = true

    // Add default life events on first-time wizard open
    if (!wizardCompleted.value && lifeEvents.value.length === 0) {
      const retirementEvent: LifeEvent = {
        id: crypto.randomUUID(),
        name: 'Retirement',
        date: { type: 'age', age: 67 },
        description: 'Default retirement life event',
      }
      const lifeExpectancyEvent: LifeEvent = {
        id: crypto.randomUUID(),
        name: 'Life expectancy',
        date: { type: 'age', age: 90 },
        description: 'Expected life span',
      }
      lifeEvents.value.push(retirementEvent, lifeExpectancyEvent)
    }
  }

  function closeWizard() {
    showWizard.value = false
  }

  function completeWizard() {
    wizardCompleted.value = true
    showWizard.value = false
  }

  function saveBasicInfo(data: {
    birthDate: Month
    taxCountry?: string
    liquidAssetsInterestRate: number
    inflationRate: number
  }) {
    const isFirstTime = !wizardCompleted.value

    birthDate.value = data.birthDate
    taxCountry.value = data.taxCountry
    liquidAssetsInterestRate.value = data.liquidAssetsInterestRate
    inflationRate.value = data.inflationRate

    // Add default financial items on first-time wizard completion
    if (isFirstTime) {
      // Find the retirement event (should have been created when wizard opened)
      const retirementEvent = lifeEvents.value.find((le) => le.name === 'Retirement')

      // Add savings account
      const savingsAccount = new LiquidAsset(
        crypto.randomUUID(),
        'Savings',
        10000,
        undefined,
        undefined,
      )
      capitalAccounts.value.push(savingsAccount)

      // Add salary income (from now until retirement)
      const salaryIncome = new CashFlow(
        crypto.randomUUID(),
        'Salary',
        2500,
        'income',
        undefined, // Start immediately
        retirementEvent ? { type: 'lifeEvent', eventId: retirementEvent.id } : undefined,
        true, // Follows inflation
        false, // Not one-time
        undefined,
        'monthly',
      )
      cashFlows.value.push(salaryIncome)

      // Add pension income (from retirement onward)
      const pensionIncome = new CashFlow(
        crypto.randomUUID(),
        'Pension',
        1500,
        'income',
        retirementEvent ? { type: 'lifeEvent', eventId: retirementEvent.id } : undefined,
        undefined, // No end date
        true, // Follows inflation
        false, // Not one-time
        undefined,
        'monthly',
      )
      cashFlows.value.push(pensionIncome)

      // Add living expenses
      const livingExpenses = new CashFlow(
        crypto.randomUUID(),
        'Living expenses',
        1500,
        'expense',
        undefined, // Start immediately
        undefined, // No end date
        true, // Follows inflation
        false, // Not one-time
        undefined,
        'monthly',
      )
      cashFlows.value.push(livingExpenses)
    }

    completeWizard()
    recalculate()
  }

  function addCapitalAccount(
    account:
      | {
          type: 'liquid'
          name: string
          amount: number
          wealthTaxId?: string
          capitalGainsTaxId?: string
        }
      | {
          type: 'fixed'
          name: string
          amount: number
          annualInterestRate: number
          liquidationDate?: Month | DateSpecification
          wealthTaxId?: string
          capitalGainsTaxId?: string
        },
  ) {
    const id = crypto.randomUUID()
    let newAccount: CapitalAccount

    if (account.type === 'fixed') {
      // Convert Month to DateSpecification if needed
      const liquidationDate =
        account.liquidationDate !== undefined
          ? typeof account.liquidationDate === 'number'
            ? createAbsoluteDate(account.liquidationDate)
            : account.liquidationDate
          : undefined

      newAccount = new FixedAsset(
        id,
        account.name,
        account.amount,
        account.annualInterestRate,
        liquidationDate,
        account.wealthTaxId,
        account.capitalGainsTaxId,
      )
    } else {
      newAccount = new LiquidAsset(
        id,
        account.name,
        account.amount,
        account.wealthTaxId,
        account.capitalGainsTaxId,
      )
    }

    capitalAccounts.value.push(newAccount)
    recalculate()
  }

  function updateCapitalAccount(id: string, updates: Partial<Omit<CapitalAccount, 'id'>>) {
    const index = capitalAccounts.value.findIndex((a) => a.id === id)
    if (index !== -1) {
      const existing = capitalAccounts.value[index]

      if (existing instanceof FixedAsset) {
        capitalAccounts.value[index] = existing.with(
          updates as Partial<Omit<FixedAsset, 'id' | 'assetType'>>,
        )
      } else {
        capitalAccounts.value[index] = (existing as LiquidAsset).with(
          updates as Partial<Omit<LiquidAsset, 'id' | 'assetType'>>,
        )
      }

      recalculate()
    }
  }

  function removeCapitalAccount(id: string) {
    capitalAccounts.value = capitalAccounts.value.filter((a) => a.id !== id)
    recalculate()
  }

  function addCashFlow(cashFlow: {
    name: string
    amount: number
    type: CashFlowType
    startDate?: Month | DateSpecification
    endDate?: Month | DateSpecification
    followsInflation: boolean
    isOneTime: boolean
    incomeTaxId?: string
    frequency: CashFlowFrequency
  }) {
    // Convert Month values to DateSpecification if needed
    const startDate =
      cashFlow.startDate !== undefined
        ? typeof cashFlow.startDate === 'number'
          ? createAbsoluteDate(cashFlow.startDate)
          : cashFlow.startDate
        : undefined
    const endDate =
      cashFlow.endDate !== undefined
        ? typeof cashFlow.endDate === 'number'
          ? createAbsoluteDate(cashFlow.endDate)
          : cashFlow.endDate
        : undefined

    const newCashFlow = new CashFlow(
      crypto.randomUUID(),
      cashFlow.name,
      cashFlow.amount,
      cashFlow.type,
      startDate,
      endDate,
      cashFlow.followsInflation,
      cashFlow.isOneTime,
      cashFlow.incomeTaxId,
      cashFlow.frequency,
    )
    cashFlows.value.push(newCashFlow)
    recalculate()
  }

  function updateCashFlow(id: string, updates: Partial<Omit<CashFlow, 'id'>>) {
    const index = cashFlows.value.findIndex((cf) => cf.id === id)
    if (index !== -1) {
      const existing = cashFlows.value[index]
      if (existing) {
        cashFlows.value[index] = existing.with(updates as Partial<Omit<CashFlow, 'id'>>)
      }
      recalculate()
    }
  }

  function removeCashFlow(id: string) {
    cashFlows.value = cashFlows.value.filter((cf) => cf.id !== id)
    recalculate()
  }

  function addDebt(debt: AllDebtTypes) {
    debts.value.push(debt)
    recalculate()
  }

  function updateDebt(id: string, updates: Partial<AllDebtTypes>) {
    const index = debts.value.findIndex((d: AllDebtTypes) => d.id === id)
    if (index !== -1) {
      const existing = debts.value[index]
      if (existing) {
        debts.value[index] = existing.with(updates as Partial<Omit<typeof existing, 'id'>>)
      }
      recalculate()
    }
  }

  function removeDebt(id: string) {
    debts.value = debts.value.filter((d: AllDebtTypes) => d.id !== id)
    recalculate()
  }

  // Life Event actions
  function addLifeEvent(data: { name: string; date?: DateSpecification; description?: string }) {
    const newLifeEvent: LifeEvent = {
      id: crypto.randomUUID(),
      name: data.name,
      date: data.date,
      description: data.description,
    }
    lifeEvents.value.push(newLifeEvent)
    recalculate() // Recalculate because dependent items may now resolve
  }

  function updateLifeEvent(id: string, updates: Partial<Omit<LifeEvent, 'id'>>) {
    const index = lifeEvents.value.findIndex((le: LifeEvent) => le.id === id)
    if (index !== -1) {
      const existing = lifeEvents.value[index]
      if (existing) {
        lifeEvents.value[index] = {
          id: existing.id,
          name: updates.name ?? existing.name,
          date: updates.date !== undefined ? updates.date : existing.date,
          description:
            updates.description !== undefined ? updates.description : existing.description,
        }
        recalculate() // Recalculate because dependent items may have changed
      }
    }
  }

  function removeLifeEvent(id: string) {
    // Check if any items reference this life event
    const references = findItemsReferencingLifeEvent(id)
    const totalReferences =
      references.cashFlows.length + references.debts.length + references.assets.length

    if (totalReferences > 0) {
      // For now, prevent deletion if items reference this event
      // In the future, we could offer to convert references to absolute dates
      throw new Error(
        `Cannot delete life event: ${totalReferences} item(s) still reference it. Please update those items first.`,
      )
    }

    lifeEvents.value = lifeEvents.value.filter((le: LifeEvent) => le.id !== id)
    recalculate()
  }

  function getLifeEventById(id: string): LifeEvent | undefined {
    return lifeEvents.value.find((le: LifeEvent) => le.id === id)
  }

  function findItemsReferencingLifeEvent(eventId: string): {
    cashFlows: CashFlow[]
    debts: AllDebtTypes[]
    assets: CapitalAccount[]
  } {
    const referencedCashFlows = cashFlows.value.filter(
      (cf) =>
        (cf.startDate?.type === 'lifeEvent' && cf.startDate.eventId === eventId) ||
        (cf.endDate?.type === 'lifeEvent' && cf.endDate.eventId === eventId),
    )

    const referencedDebts = debts.value.filter(
      (d) =>
        (d.startDate?.type === 'lifeEvent' && d.startDate.eventId === eventId) ||
        (d.endDate?.type === 'lifeEvent' && d.endDate.eventId === eventId) ||
        (d.repaymentStartDate?.type === 'lifeEvent' && d.repaymentStartDate.eventId === eventId),
    )

    const referencedAssets = capitalAccounts.value.filter((a) => {
      if (a instanceof FixedAsset) {
        return a.liquidationDate?.type === 'lifeEvent' && a.liquidationDate.eventId === eventId
      }
      return false
    })

    return {
      cashFlows: referencedCashFlows,
      debts: referencedDebts,
      assets: referencedAssets,
    }
  }

  // Auto-generate retirement life event if not exists
  function ensureRetirementEvent(): LifeEvent {
    let retirement = lifeEvents.value.find(
      (le: LifeEvent) => le.name.toLowerCase() === 'retirement',
    )

    if (!retirement) {
      // Determine default retirement age based on tax country
      const defaultAge = taxCountry.value === 'NL' ? 67 : 65

      retirement = {
        id: crypto.randomUUID(),
        name: 'Retirement',
        date: { type: 'age', age: defaultAge },
        description: 'Default retirement life event',
      }

      lifeEvents.value.push(retirement)
    }

    return retirement
  }

  function recalculate() {
    if (birthDate.value) {
      projectionResult.value = calculateProjections(userProfile.value)
    }
  }

  function saveToStorage() {
    storageService.saveProfile(userProfile.value)
    // Save wizard completion state separately
    try {
      localStorage.setItem('moneymap-wizard-completed', JSON.stringify(wizardCompleted.value))
    } catch (error) {
      console.error('Failed to save wizard state:', error)
    }
  }

  function loadFromStorage() {
    const profile = storageService.loadProfile()
    if (profile) {
      // Profile is already a UserProfile instance with proper class instances
      birthDate.value = profile.birthDate
      capitalAccounts.value = profile.capitalAccounts
      cashFlows.value = profile.cashFlows
      debts.value = profile.debts as AllDebtTypes[]
      liquidAssetsInterestRate.value = profile.liquidAssetsInterestRate
      inflationRate.value = profile.inflationRate
      taxCountry.value = profile.taxCountry
      recalculate()

      // Load wizard completion state
      try {
        const wizardState = localStorage.getItem('moneymap-wizard-completed')
        if (wizardState !== null) {
          wizardCompleted.value = JSON.parse(wizardState)
        }
      } catch (error) {
        console.error('Failed to load wizard state:', error)
      }

      return true
    }
    return false
  }

  function clearAll() {
    birthDate.value = addMonths(getCurrentMonth(), -360) // 30 years ago
    capitalAccounts.value = []
    cashFlows.value = []
    debts.value = []
    lifeEvents.value = []
    liquidAssetsInterestRate.value = 7
    inflationRate.value = 3
    taxCountry.value = undefined
    projectionResult.value = null
    wizardCompleted.value = false
    showWizard.value = false
    storageService.clearProfile()
    try {
      localStorage.removeItem('moneymap-wizard-completed')
    } catch (error) {
      console.error('Failed to clear wizard state:', error)
    }
  }

  // Helper getters
  function getCapitalAccountById(id: string): CapitalAccount | undefined {
    return capitalAccounts.value.find((a) => a.id === id)
  }

  function getCashFlowById(id: string): CashFlow | undefined {
    return cashFlows.value.find((cf) => cf.id === id) as CashFlow | undefined
  }

  function getDebtById(id: string): AllDebtTypes | undefined {
    return debts.value.find((d: AllDebtTypes) => d.id === id)
  }

  return {
    // State
    birthDate,
    capitalAccounts,
    cashFlows,
    debts,
    lifeEvents,
    liquidAssetsInterestRate,
    inflationRate,
    taxCountry,
    projectionResult,
    wizardCompleted,
    showWizard,
    // Computed
    userProfile,
    currentAge,
    totalCapital,
    hasData,
    allItems,
    totalAssets,
    totalIncome,
    totalExpenses,
    totalDebt,
    // Actions
    setBirthDate,
    setLiquidAssetsInterestRate,
    setInflationRate,
    setTaxCountry,
    openWizard,
    closeWizard,
    completeWizard,
    saveBasicInfo,
    addCapitalAccount,
    updateCapitalAccount,
    removeCapitalAccount,
    addCashFlow,
    updateCashFlow,
    removeCashFlow,
    addDebt,
    updateDebt,
    removeDebt,
    addLifeEvent,
    updateLifeEvent,
    removeLifeEvent,
    recalculate,
    saveToStorage,
    loadFromStorage,
    clearAll,
    // Helpers
    getCapitalAccountById,
    getCashFlowById,
    getDebtById,
    getLifeEventById,
    findItemsReferencingLifeEvent,
    ensureRetirementEvent,
  }
})
