/**
 * Pinia store for financial planner state management
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
} from '@/models'
import { storageService } from '@/services/storage'
import { calculateProjections } from '@/services/calculator'
import type { Month } from '@/types/month'
import { getCurrentMonth } from '@/types/month'

export const usePlannerStore = defineStore('planner', () => {
  // State
  const birthDate = ref<Month>(getCurrentMonth())
  const capitalAccounts = ref<CapitalAccount[]>([])
  const cashFlows = ref<CashFlow[]>([])
  const debts = ref<AllDebtTypes[]>([])
  const liquidAssetsInterestRate = ref<number>(5) // Default 5% for all liquid assets
  const inflationRate = ref<number>(2.5) // Default 2.5% inflation
  const projectionResult = ref<ProjectionResult | null>(null)

  // Computed
  const userProfile = computed<UserProfile>(() => {
    return new UserProfile(
      birthDate.value,
      capitalAccounts.value as CapitalAccount[],
      cashFlows.value as CashFlow[],
      liquidAssetsInterestRate.value,
      debts.value as AllDebtTypes[],
      inflationRate.value
    )
  })

  const currentAge = computed(() => {
    return userProfile.value.getCurrentAge()
  })

  const totalCapital = computed(() =>
    capitalAccounts.value.reduce((sum, account) => sum + account.amount, 0),
  )

  const hasData = computed(
    () =>
      capitalAccounts.value.length > 0 || cashFlows.value.length > 0 || debts.value.length > 0,
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
      .reduce((sum, cf) => sum + cf.monthlyAmount * 12, 0),
  )

  const totalExpenses = computed(() =>
    cashFlows.value
      .filter((cf) => cf.type === 'expense')
      .reduce((sum, cf) => sum + cf.monthlyAmount * 12, 0),
  )

  const totalDebt = computed(() => debts.value.reduce((sum: number, debt: AllDebtTypes) => sum + debt.amount, 0))

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

  function addCapitalAccount(
    account:
      | { type: 'liquid'; name: string; amount: number }
      | { type: 'fixed'; name: string; amount: number; annualInterestRate: number; liquidationDate?: Month }
  ) {
    const id = crypto.randomUUID()
    let newAccount: CapitalAccount

    if (account.type === 'fixed') {
      newAccount = new FixedAsset(
        id,
        account.name,
        account.amount,
        account.annualInterestRate,
        account.liquidationDate
      )
    } else {
      newAccount = new LiquidAsset(id, account.name, account.amount)
    }

    capitalAccounts.value.push(newAccount)
    recalculate()
  }

  function updateCapitalAccount(id: string, updates: Partial<Omit<CapitalAccount, 'id'>>) {
    const index = capitalAccounts.value.findIndex((a) => a.id === id)
    if (index !== -1) {
      const existing = capitalAccounts.value[index]

      if (existing instanceof FixedAsset) {
        capitalAccounts.value[index] = existing.with(updates as any)
      } else {
        capitalAccounts.value[index] = (existing as LiquidAsset).with(updates as any)
      }

      recalculate()
    }
  }

  function removeCapitalAccount(id: string) {
    capitalAccounts.value = capitalAccounts.value.filter((a) => a.id !== id)
    recalculate()
  }

  function addCashFlow(cashFlow: Omit<CashFlow, 'id'>) {
    const newCashFlow = new CashFlow(
      crypto.randomUUID(),
      cashFlow.name,
      cashFlow.monthlyAmount,
      cashFlow.type,
      cashFlow.startDate,
      cashFlow.endDate,
      cashFlow.followsInflation
    )
    cashFlows.value.push(newCashFlow)
    recalculate()
  }

  function updateCashFlow(id: string, updates: Partial<Omit<CashFlow, 'id'>>) {
    const index = cashFlows.value.findIndex((cf) => cf.id === id)
    if (index !== -1) {
      const existing = cashFlows.value[index]
      if (existing) {
        cashFlows.value[index] = existing.with(updates as any)
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
        debts.value[index] = existing.with(updates as any)
      }
      recalculate()
    }
  }

  function removeDebt(id: string) {
    debts.value = debts.value.filter((d: AllDebtTypes) => d.id !== id)
    recalculate()
  }

  function recalculate() {
    if (birthDate.value) {
      projectionResult.value = calculateProjections(userProfile.value)
    }
  }

  function saveToStorage() {
    storageService.saveProfile(userProfile.value)
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
      recalculate()
      return true
    }
    return false
  }

  function clearAll() {
    birthDate.value = getCurrentMonth()
    capitalAccounts.value = []
    cashFlows.value = []
    debts.value = []
    liquidAssetsInterestRate.value = 5
    inflationRate.value = 2.5
    projectionResult.value = null
    storageService.clearProfile()
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
    liquidAssetsInterestRate,
    inflationRate,
    projectionResult,
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
    addCapitalAccount,
    updateCapitalAccount,
    removeCapitalAccount,
    addCashFlow,
    updateCashFlow,
    removeCashFlow,
    addDebt,
    updateDebt,
    removeDebt,
    recalculate,
    saveToStorage,
    loadFromStorage,
    clearAll,
    // Helpers
    getCapitalAccountById,
    getCashFlowById,
    getDebtById,
  }
})
