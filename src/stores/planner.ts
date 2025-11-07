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
} from '@/models'
import { storageService } from '@/services/storage'
import { calculateProjections } from '@/services/calculator'

export const usePlannerStore = defineStore('planner', () => {
  // State
  const birthDate = ref<string>('')
  const capitalAccounts = ref<CapitalAccount[]>([])
  const cashFlows = ref<CashFlow[]>([])
  const liquidAssetsInterestRate = ref<number>(5) // Default 5% for all liquid assets
  const projectionResult = ref<ProjectionResult | null>(null)

  // Computed
  const userProfile = computed<UserProfile>(() => {
    const defaultDate = new Date().toISOString().split('T')[0]
    const date: string = (birthDate.value || defaultDate) as string
    return new UserProfile(
      date,
      capitalAccounts.value as CapitalAccount[],
      cashFlows.value as CashFlow[],
      liquidAssetsInterestRate.value
    )
  })

  const currentAge = computed(() => {
    if (!birthDate.value) return 0
    return userProfile.value.getCurrentAge()
  })

  const totalCapital = computed(() =>
    capitalAccounts.value.reduce((sum, account) => sum + account.amount, 0),
  )

  const hasData = computed(
    () =>
      birthDate.value !== '' && (capitalAccounts.value.length > 0 || cashFlows.value.length > 0),
  )

  // New computed properties for unified list
  const allItems = computed(() => {
    return [...capitalAccounts.value, ...cashFlows.value] as (CapitalAccount | CashFlow)[]
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

  // Actions
  function setBirthDate(date: string) {
    birthDate.value = date
    recalculate()
  }

  function setLiquidAssetsInterestRate(rate: number) {
    liquidAssetsInterestRate.value = rate
    recalculate()
  }

  function addCapitalAccount(
    account:
      | { type: 'liquid'; name: string; amount: number }
      | { type: 'fixed'; name: string; amount: number; annualInterestRate: number }
  ) {
    const id = crypto.randomUUID()
    let newAccount: CapitalAccount

    if (account.type === 'fixed') {
      newAccount = new FixedAsset(
        id,
        account.name,
        account.amount,
        account.annualInterestRate
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
      cashFlow.endDate
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
      liquidAssetsInterestRate.value = profile.liquidAssetsInterestRate
      recalculate()
      return true
    }
    return false
  }

  function clearAll() {
    birthDate.value = ''
    capitalAccounts.value = []
    cashFlows.value = []
    liquidAssetsInterestRate.value = 5
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

  return {
    // State
    birthDate,
    capitalAccounts,
    cashFlows,
    liquidAssetsInterestRate,
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
    // Actions
    setBirthDate,
    setLiquidAssetsInterestRate,
    addCapitalAccount,
    updateCapitalAccount,
    removeCapitalAccount,
    addCashFlow,
    updateCashFlow,
    removeCashFlow,
    recalculate,
    saveToStorage,
    loadFromStorage,
    clearAll,
    // Helpers
    getCapitalAccountById,
    getCashFlowById,
  }
})
