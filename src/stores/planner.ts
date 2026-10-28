/**
 * Pinia store for MoneyMap state management
 */

import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import {
  UserProfile,
  LiquidAsset,
  FixedAsset,
  CashFlow,
  Debt,
  isCashFlow,
  type CapitalAccount,
  type ProjectionResult,
  type ItemMonthlySnapshot,
  type CashFlowType,
  type CashFlowFrequency,
  type LifeEvent,
} from '@/models'
import { storageService } from '@/services/storage'
import { calculateProjections } from '@/services/calculator'
import {
  createDefaultBirthDate,
  createDefaultItems,
  createDefaultLifeEvents,
  DEFAULT_INFLATION_RATE,
  DEFAULT_INTEREST_RATE,
} from '@/services/sampleData'
import type { Month, DateSpecification } from '@/types/month'
import { createAbsoluteDate } from '@/types/month'

export const usePlannerStore = defineStore('planner', () => {
  // State
  // Default to 30 years ago (30 * 12 months = 360 months)
  const birthDate = ref<Month>(createDefaultBirthDate())
  const capitalAccounts = ref<CapitalAccount[]>([])
  const cashFlows = ref<CashFlow[]>([])
  const debts = ref<Debt[]>([])
  const lifeEvents = ref<LifeEvent[]>([])
  const liquidAssetsInterestRate = ref<number>(DEFAULT_INTEREST_RATE)
  const inflationRate = ref<number>(DEFAULT_INFLATION_RATE)
  const taxCountry = ref<string | undefined>(undefined) // ISO country code for tax calculations
  const primaryAccountId = ref<string | undefined>(undefined) // Default liquid account for flows
  const projectionResult = ref<ProjectionResult | null>(null)

  // Timeline scrubber state (transient; not persisted)
  const selectedMonthOffset = ref<number>(0)

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
      debts.value as Debt[],
      inflationRate.value,
      taxCountry.value,
      lifeEvents.value,
      primaryAccountId.value,
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
      | Debt
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
    debts.value.reduce((sum: number, debt: Debt) => sum + debt.amount, 0),
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

  function setPrimaryAccountId(id: string | undefined) {
    primaryAccountId.value = id
    recalculate()
  }

  function openWizard() {
    showWizard.value = true

    // Add default life events on first-time wizard open
    if (!wizardCompleted.value && lifeEvents.value.length === 0) {
      lifeEvents.value.push(...createDefaultLifeEvents())
    }
  }

  function closeWizard() {
    showWizard.value = false
  }

  function completeWizard() {
    wizardCompleted.value = true
    showWizard.value = false
  }

  function completeWizardWithDefaults() {
    const isFirstTime = !wizardCompleted.value

    // Add default financial items on first-time wizard completion
    if (isFirstTime) {
      // Find the retirement event (should have been created when wizard opened)
      const retirementEvent = lifeEvents.value.find((le) => le.name === 'Retirement')

      const defaults = createDefaultItems(retirementEvent?.id)
      capitalAccounts.value.push(...defaults.capitalAccounts)
      cashFlows.value.push(...defaults.cashFlows)

      recalculate()
    }

    completeWizard()
  }

  function addCapitalAccount(
    account:
      | {
          type: 'liquid'
          name: string
          amount: number
          annualInterestRate?: number
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
        account.annualInterestRate,
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
    if (primaryAccountId.value === id) primaryAccountId.value = undefined
    cashFlows.value = cashFlows.value.map((flow) =>
      flow.accountId === id ? flow.with({ accountId: undefined }) : flow,
    )
    debts.value = debts.value.map((debt) =>
      debt.accountId === id ? debt.with({ accountId: undefined }) : debt,
    )
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
    accountId?: string
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
      cashFlow.accountId,
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

  function addDebt(debt: Debt) {
    debts.value.push(debt)
    recalculate()
  }

  function updateDebt(id: string, updates: Partial<Debt>) {
    const index = debts.value.findIndex((d: Debt) => d.id === id)
    if (index !== -1) {
      const existing = debts.value[index]
      if (existing) {
        debts.value[index] = existing.with(updates as Partial<Omit<typeof existing, 'id'>>)
      }
      recalculate()
    }
  }

  function removeDebt(id: string) {
    debts.value = debts.value.filter((d: Debt) => d.id !== id)
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
    debts: Debt[]
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
      // Reset the scrubber so it never points past the new projection end.
      const max = projectionResult.value?.monthlyProjections.length ?? 0
      if (selectedMonthOffset.value > max - 1) {
        selectedMonthOffset.value = Math.max(0, max - 1)
      }
    }
  }

  function saveToStorage() {
    storageService.saveProfile(userProfile.value)
    storageService.saveWizardCompleted(wizardCompleted.value)
  }

  // Save on every change to persisted state.
  watch([userProfile, wizardCompleted], saveToStorage, { deep: true })

  function loadFromStorage() {
    const profile = storageService.loadProfile()
    if (profile) {
      // Profile is already a UserProfile instance with proper class instances
      birthDate.value = profile.birthDate
      capitalAccounts.value = profile.capitalAccounts
      cashFlows.value = profile.cashFlows
      debts.value = profile.debts as Debt[]
      liquidAssetsInterestRate.value = profile.liquidAssetsInterestRate
      inflationRate.value = profile.inflationRate
      taxCountry.value = profile.taxCountry
      primaryAccountId.value = profile.primaryAccountId
      lifeEvents.value = profile.lifeEvents
      recalculate()

      // Load wizard completion state
      const wizardState = storageService.loadWizardCompleted()
      if (wizardState !== null) {
        wizardCompleted.value = wizardState
      }

      return true
    }
    return false
  }

  function clearAll() {
    birthDate.value = createDefaultBirthDate()
    capitalAccounts.value = []
    cashFlows.value = []
    debts.value = []
    lifeEvents.value = []
    liquidAssetsInterestRate.value = DEFAULT_INTEREST_RATE
    inflationRate.value = DEFAULT_INFLATION_RATE
    taxCountry.value = undefined
    primaryAccountId.value = undefined
    projectionResult.value = null
    selectedMonthOffset.value = 0
    wizardCompleted.value = false
    showWizard.value = false
    storageService.clearProfile()
    storageService.clearWizardCompleted()
  }

  // Helper getters
  function getCapitalAccountById(id: string): CapitalAccount | undefined {
    return capitalAccounts.value.find((a) => a.id === id)
  }

  function getCashFlowById(id: string): CashFlow | undefined {
    return cashFlows.value.find((cf) => cf.id === id) as CashFlow | undefined
  }

  function getDebtById(id: string): Debt | undefined {
    return debts.value.find((d: Debt) => d.id === id)
  }

  /**
   * Find a single financial item by id across all item kinds.
   */
  function findItemById(id: string): CapitalAccount | CashFlow | Debt | undefined {
    return (
      capitalAccounts.value.find((a) => a.id === id) ??
      cashFlows.value.find((cf) => cf.id === id) ??
      debts.value.find((d) => d.id === id)
    )
  }

  /**
   * Total number of months in the current projection.
   */
  const projectionMonthCount = computed(
    () => projectionResult.value?.monthlyProjections.length ?? 0,
  )

  /**
   * Per-item snapshots at the currently selected scrubber month.
   *
   * For assets and debts the snapshot with the largest monthOffset not greater
   * than the target is returned (the item's state "at that point"). For cash
   * flows only an exact-match month is returned, since flows are sparse.
   */
  function getItemSnapshotAt(itemId: string, monthOffset: number): ItemMonthlySnapshot | undefined {
    const projection = projectionResult.value
    if (!projection) return undefined

    const itemProjection = projection.itemProjections.find((p) => p.itemId === itemId)
    if (!itemProjection || itemProjection.snapshots.length === 0) return undefined

    const snapshots = itemProjection.snapshots

    const item = findItemById(itemId)
    // Cash flows: exact month match only (sparse: only application months).
    if (item && isCashFlow(item)) {
      return snapshots.find((s) => s.monthOffset === monthOffset)
    }

    // Assets and debts: largest monthOffset not greater than the target.
    // Snapshots are sorted ascending by monthOffset; binary search for the slot.
    let lo = 0
    let hi = snapshots.length - 1
    let result: ItemMonthlySnapshot | undefined
    while (lo <= hi) {
      const mid = (lo + hi) >> 1
      const snap = snapshots[mid]!
      if (snap.monthOffset === monthOffset) return snap
      if (snap.monthOffset < monthOffset) {
        result = snap
        lo = mid + 1
      } else {
        hi = mid - 1
      }
    }
    return result
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
    primaryAccountId,
    projectionResult,
    wizardCompleted,
    showWizard,
    selectedMonthOffset,
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
    projectionMonthCount,
    // Actions
    setBirthDate,
    setLiquidAssetsInterestRate,
    setInflationRate,
    setTaxCountry,
    setPrimaryAccountId,
    openWizard,
    closeWizard,
    completeWizard,
    completeWizardWithDefaults,
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
    findItemById,
    getItemSnapshotAt,
    getLifeEventById,
    findItemsReferencingLifeEvent,
    ensureRetirementEvent,
  }
})
