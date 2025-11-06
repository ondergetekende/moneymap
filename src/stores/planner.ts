/**
 * Pinia store for financial planner state management
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type {
  UserProfile,
  CapitalAccount,
  LiquidAsset,
  FixedAsset,
  CashFlow,
  ProjectionResult,
} from '@/types/models'
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
  const userProfile = computed<UserProfile>(() => ({
    birthDate: birthDate.value,
    capitalAccounts: capitalAccounts.value,
    cashFlows: cashFlows.value,
    liquidAssetsInterestRate: liquidAssetsInterestRate.value,
  }))

  const currentAge = computed(() => {
    if (!birthDate.value) return 0
    const birth = new Date(birthDate.value)
    const today = new Date()
    let age = today.getFullYear() - birth.getFullYear()
    const monthDiff = today.getMonth() - birth.getMonth()
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--
    }
    return age
  })

  const totalCapital = computed(() =>
    capitalAccounts.value.reduce((sum, account) => sum + account.amount, 0),
  )

  const hasData = computed(
    () =>
      birthDate.value !== '' && (capitalAccounts.value.length > 0 || cashFlows.value.length > 0),
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

  function addCapitalAccount(account: Omit<CapitalAccount, 'id'>) {
    capitalAccounts.value.push({
      ...account,
      id: crypto.randomUUID(),
    } as CapitalAccount)
    recalculate()
  }

  function updateCapitalAccount(id: string, updates: Partial<CapitalAccount>) {
    const index = capitalAccounts.value.findIndex((a) => a.id === id)
    if (index !== -1) {
      capitalAccounts.value[index] = {
        ...capitalAccounts.value[index],
        ...updates,
      } as CapitalAccount
      recalculate()
    }
  }

  function removeCapitalAccount(id: string) {
    capitalAccounts.value = capitalAccounts.value.filter((a) => a.id !== id)
    recalculate()
  }

  function addCashFlow(cashFlow: Omit<CashFlow, 'id'>) {
    const newCashFlow: CashFlow = {
      ...cashFlow,
      id: crypto.randomUUID(),
    }
    cashFlows.value.push(newCashFlow)
    recalculate()
  }

  function updateCashFlow(id: string, updates: Partial<CashFlow>) {
    const index = cashFlows.value.findIndex((cf) => cf.id === id)
    if (index !== -1) {
      cashFlows.value[index] = { ...cashFlows.value[index], ...updates } as CashFlow
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
      birthDate.value = profile.birthDate
      // Ensure all loaded accounts are properly typed (for legacy data)
      capitalAccounts.value = profile.capitalAccounts.map((account) => {
        if (account.assetType === 'fixed') {
          const fixedAccount = account as FixedAsset
          return {
            id: fixedAccount.id,
            name: fixedAccount.name,
            amount: fixedAccount.amount,
            annualInterestRate: fixedAccount.annualInterestRate,
            assetType: 'fixed',
          } as FixedAsset
        } else {
          // Either 'liquid' or undefined (legacy data without assetType)
          return {
            id: account.id,
            name: account.name,
            amount: account.amount,
            assetType: 'liquid',
          } as LiquidAsset
        }
      })
      cashFlows.value = profile.cashFlows
      liquidAssetsInterestRate.value = profile.liquidAssetsInterestRate ?? 5
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
  }
})
