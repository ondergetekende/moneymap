/**
 * Financial projection calculation engine
 */

import type {
  UserProfile,
  MonthlyProjection,
  AnnualSummary,
  ProjectionResult,
  ItemMonthlySnapshot,
  ItemProjection,
} from '@/models'
import { LiquidAsset, FixedAsset } from '@/models'
import type { CashFlow, Debt } from '@/models'
import type { Month, DateSpecification } from '@/types/month'
import { getCurrentMonth, addMonths, formatMonth, monthDiff, resolveDate } from '@/types/month'
import {
  resolveTaxOption,
  calculateTax,
  calculateMonthlyIncomeTax,
  type InflationAdjustment,
} from './taxCalculator'

const FALLBACK_MAX_AGE = 90

/**
 * Resolve a DateSpecification to an absolute Month value
 */
function resolveDateSpec(
  spec: DateSpecification | undefined,
  profile: UserProfile,
): Month | undefined {
  return resolveDate(spec, profile.birthDate, profile.lifeEvents)
}

/**
 * Find the latest life event date or fallback to age 90
 */
function getSimulationEndAge(profile: UserProfile): number {
  let latestEventAge: number | undefined = undefined

  // Find the latest resolved life event
  for (const event of profile.lifeEvents) {
    if (event.date) {
      const resolvedMonth = resolveDateSpec(event.date, profile)
      if (resolvedMonth !== undefined) {
        const eventAge = Math.floor(monthDiff(resolvedMonth, profile.birthDate) / 12)
        if (latestEventAge === undefined || eventAge > latestEventAge) {
          latestEventAge = eventAge
        }
      }
    }
  }

  // Use the latest life event if found, otherwise fallback to age 90
  return latestEventAge ?? FALLBACK_MAX_AGE
}

/**
 * Check if a month is within a range (inclusive start, exclusive end)
 * If startMonth is missing, treats as "from the beginning"
 * If endMonth is missing, treats as "forever"
 */
function isMonthInRange(month: Month, startMonth?: Month, endMonth?: Month): boolean {
  if (startMonth === undefined && endMonth === undefined) {
    return true // No date constraints, always active
  }

  if (startMonth === undefined) {
    // Only end month specified - active until end month
    return month < endMonth!
  }

  if (endMonth === undefined) {
    // Only start month specified - active from start month onwards
    return month >= startMonth
  }

  // Both months specified - traditional range check
  return month >= startMonth && month < endMonth
}

/**
 * Mutable tracking state for a liquid account across the projection.
 * Carries the original LiquidAsset fields (tax IDs, rate override) plus the
 * running balance. Each account has its own balance and interest rate.
 */
interface LiquidAssetTracking {
  id: string
  amount: number
  annualInterestRate?: number // Per-account override; undefined = use profile rate
  wealthTaxId?: string
  capitalGainsTaxId?: string
  balance: number
}

/**
 * Mutable tracking state for a fixed asset across the projection.
 * Carries the original FixedAsset fields (amount, tax IDs, rate) plus the
 * running balance and resolved liquidation date.
 */
interface FixedAssetTracking {
  id: string
  amount: number
  annualInterestRate: number
  wealthTaxId?: string
  capitalGainsTaxId?: string
  balance: number
  resolvedLiquidationDate: Month | undefined
}

/**
 * Mutable tracking state for a debt across the projection.
 */
interface DebtTracking {
  debt: Debt
  balance: number
  isPaidOff: boolean
  resolvedStartDate: Month | undefined
  resolvedRepaymentStartDate: Month | undefined
  resolvedEndDate: Month | undefined
}

/**
 * Pre-resolved cash flow dates, so they are not recomputed each month.
 */
interface CashFlowTracking {
  cashFlow: CashFlow
  resolvedStartDate: Month | undefined
  resolvedEndDate: Month | undefined
  accountId: string | undefined // Routing override; falls back to primary
}

/**
 * Build tracking state for liquid accounts, one balance per account.
 */
function buildLiquidAssetTracking(liquidAccounts: LiquidAsset[]): LiquidAssetTracking[] {
  return liquidAccounts.map((account) => ({
    ...account,
    balance: account.amount,
  }))
}

/**
 * Build tracking state for fixed assets, resolving liquidation dates once.
 */
function buildFixedAssetTracking(
  fixedAccounts: FixedAsset[],
  profile: UserProfile,
): FixedAssetTracking[] {
  return fixedAccounts.map((account) => ({
    ...account,
    balance: account.amount,
    resolvedLiquidationDate: resolveDateSpec(account.liquidationDate, profile),
  }))
}

/**
 * Build tracking state for debts, projecting past repayments to the start.
 */
function buildDebtTracking(
  debts: Debt[],
  profile: UserProfile,
  projectionStart: Month,
): {
  tracking: DebtTracking[]
  initialTotalDebt: number
} {
  const tracking = debts.map((debt): DebtTracking => {
    let currentBalance = debt.amount

    const debtStartMonth = resolveDateSpec(debt.startDate, profile)
    const repaymentStartMonth = resolveDateSpec(debt.repaymentStartDate, profile) ?? debtStartMonth

    // For debts that started repaying before the simulation start, fast-forward.
    if (repaymentStartMonth !== undefined && repaymentStartMonth < projectionStart) {
      const monthsPassed = monthDiff(projectionStart, repaymentStartMonth)
      if (monthsPassed > 0) {
        currentBalance = debt.calculateProjectedBalance(debt.amount, monthsPassed)
      }
    }

    return {
      debt,
      balance: currentBalance,
      isPaidOff: currentBalance <= 0,
      resolvedStartDate: debtStartMonth,
      resolvedRepaymentStartDate: repaymentStartMonth,
      resolvedEndDate: resolveDateSpec(debt.endDate, profile),
    }
  })

  const initialTotalDebt = tracking.reduce((sum, d) => sum + d.balance, 0)
  return { tracking, initialTotalDebt }
}

/**
 * Build pre-resolved cash flow date tracking.
 */
function buildCashFlowTracking(cashFlows: CashFlow[], profile: UserProfile): CashFlowTracking[] {
  return cashFlows.map((cashFlow) => ({
    cashFlow,
    resolvedStartDate: resolveDateSpec(cashFlow.startDate, profile),
    resolvedEndDate: resolveDateSpec(cashFlow.endDate, profile),
    accountId: cashFlow.accountId,
  }))
}

/**
 * Apply liquid asset interest, fixed asset appreciation/liquidation and wealth tax.
 *
 * Updates the liquid balance and fixed asset balances in place, and returns the
 * capital gains and wealth tax charged this month.
 */
function applyAssetGrowthAndTaxes(
  state: {
    liquidBalances: Map<string, number> // Per-account balances
    fixedAssets: FixedAssetTracking[]
  },
  liquidTrackings: LiquidAssetTracking[],
  primaryAccountId: string | undefined,
  profileRate: number,
  taxCountry: string | undefined,
  currentMonth: Month,
  inflationAdjustment: InflationAdjustment,
): { capitalGainsTax: number; wealthTax: number; liquidatedIds: Set<string> } {
  let capitalGainsTax = 0
  let wealthTax = 0
  const liquidatedIds = new Set<string>()

  // Each liquid account earns interest on its own balance at its own rate.
  // Capital gains tax on that interest is paid from the account itself.
  for (const account of liquidTrackings) {
    const balance = state.liquidBalances.get(account.id) ?? 0
    if (balance === 0) continue

    const monthlyRate = (account.annualInterestRate ?? profileRate) / 100 / 12
    const interest = balance * monthlyRate
    const newBalance = balance + interest

    const taxOption = resolveTaxOption(account.capitalGainsTaxId, taxCountry, 'capital_gains')
    if (taxOption && interest > 0) {
      const annualTax = calculateTax(interest * 12, taxOption, inflationAdjustment)
      const monthlyTax = annualTax / 12
      capitalGainsTax += monthlyTax
      state.liquidBalances.set(account.id, newBalance - monthlyTax)
    } else {
      state.liquidBalances.set(account.id, newBalance)
    }
  }

  // Appreciate each fixed asset and trigger liquidation when due.
  for (const asset of state.fixedAssets) {
    const monthlyRate = asset.annualInterestRate / 100 / 12
    asset.balance += asset.balance * monthlyRate

    const due =
      asset.resolvedLiquidationDate !== undefined &&
      currentMonth >= asset.resolvedLiquidationDate &&
      asset.balance > 0
    if (!due) continue

    const taxOption = resolveTaxOption(asset.capitalGainsTaxId, taxCountry, 'capital_gains')
    const totalGain = asset.balance - asset.amount
    let proceeds = asset.balance
    if (taxOption && totalGain > 0) {
      const gainTax = calculateTax(totalGain, taxOption, inflationAdjustment)
      capitalGainsTax += gainTax
      proceeds -= gainTax
    }

    // Net proceeds land in the primary account.
    if (primaryAccountId !== undefined) {
      state.liquidBalances.set(
        primaryAccountId,
        (state.liquidBalances.get(primaryAccountId) ?? 0) + proceeds,
      )
    }
    asset.balance = 0
    liquidatedIds.add(asset.id)
  }

  // Wealth tax on liquid assets: paid from the account itself.
  for (const account of liquidTrackings) {
    const taxOption = resolveTaxOption(account.wealthTaxId, taxCountry, 'wealth')
    if (!taxOption) continue
    const value = state.liquidBalances.get(account.id) ?? 0
    if (value <= 0) continue
    const monthlyWealthTax = calculateTax(value, taxOption, inflationAdjustment) / 12
    wealthTax += monthlyWealthTax
    state.liquidBalances.set(account.id, value - monthlyWealthTax)
  }

  // Wealth tax on fixed assets: paid from the primary account.
  if (primaryAccountId !== undefined) {
    let fixedWealthTax = 0
    for (const asset of state.fixedAssets) {
      if (asset.balance <= 0) continue
      const taxOption = resolveTaxOption(asset.wealthTaxId, taxCountry, 'wealth')
      if (!taxOption) continue
      fixedWealthTax += calculateTax(asset.balance, taxOption, inflationAdjustment) / 12
    }
    if (fixedWealthTax > 0) {
      wealthTax += fixedWealthTax
      state.liquidBalances.set(
        primaryAccountId,
        (state.liquidBalances.get(primaryAccountId) ?? 0) - fixedWealthTax,
      )
    }
  }

  return { capitalGainsTax, wealthTax, liquidatedIds }
}

/**
 * Per-debt payment result for a single month, used for item snapshots.
 */
interface DebtItemResult {
  interest: number
  principal: number
}

/**
 * Process debt payments for the month, deducting from the liquid balance.
 *
 * Returns the per-debt payments keyed by debt id, plus the rolled-up totals.
 */
function processDebtPayments(
  state: { liquidBalances: Map<string, number>; debts: DebtTracking[] },
  primaryAccountId: string | undefined,
  currentMonth: Month,
): { debtInterest: number; debtPrincipal: number; perDebt: Map<string, DebtItemResult> } {
  let debtInterest = 0
  let debtPrincipal = 0
  const perDebt = new Map<string, DebtItemResult>()

  for (const tracking of state.debts) {
    // A zero balance means the debt is fully settled.
    if (tracking.balance <= 0) {
      tracking.balance = 0
      tracking.isPaidOff = true
      continue
    }
    if (tracking.isPaidOff) continue

    const debt = tracking.debt
    // Source account: the debt override, else the primary account.
    const sourceId =
      tracking.debt.accountId !== undefined && state.liquidBalances.has(tracking.debt.accountId)
        ? tracking.debt.accountId
        : primaryAccountId
    const sourceBalance = sourceId !== undefined ? (state.liquidBalances.get(sourceId) ?? 0) : 0

    // At or after the end date: make the final balloon payment.
    if (tracking.resolvedEndDate !== undefined && currentMonth >= tracking.resolvedEndDate) {
      const payment = debt.calculateMonthlyPayment(tracking.balance, 1)
      if (sourceBalance >= payment.totalPayment) {
        state.liquidBalances.set(sourceId!, sourceBalance - payment.totalPayment)
        tracking.balance -= payment.principal
        debtInterest += payment.interest
        debtPrincipal += payment.principal
        perDebt.set(debt.id, { interest: payment.interest, principal: payment.principal })
        tracking.balance = Math.max(tracking.balance, debt.finalBalance ?? 0)
        if (tracking.balance <= 0) {
          tracking.balance = 0
          tracking.isPaidOff = true
        }
      }
      continue
    }

    if (
      !debt.isRepaymentActive(
        currentMonth,
        tracking.resolvedStartDate,
        tracking.resolvedRepaymentStartDate,
        tracking.resolvedEndDate,
      )
    ) {
      continue
    }

    const monthsRemaining =
      tracking.resolvedEndDate !== undefined
        ? Math.max(1, monthDiff(tracking.resolvedEndDate, currentMonth))
        : undefined

    const payment = debt.calculateMonthlyPayment(tracking.balance, monthsRemaining)
    // Skip when the source account cannot cover the payment.
    if (sourceBalance < payment.totalPayment) continue

    state.liquidBalances.set(sourceId!, sourceBalance - payment.totalPayment)
    tracking.balance -= payment.principal
    debtInterest += payment.interest
    debtPrincipal += payment.principal
    perDebt.set(debt.id, { interest: payment.interest, principal: payment.principal })
    if (tracking.balance <= 0) {
      tracking.balance = 0
      tracking.isPaidOff = true
    }
  }

  return { debtInterest, debtPrincipal, perDebt }
}

/**
 * Per-cash-flow result for a single month, used for item snapshots.
 */
interface CashFlowItemResult {
  amount: number // The (inflation-adjusted) monthly amount applied
  type: 'income' | 'expense'
}

/**
 * Apply recurring and one-time cash flows for the month.
 *
 * Returns income, expenses and income tax, plus the per-cash-flow amounts
 * keyed by cash-flow id for item snapshots.
 */
function processCashFlows(
  state: { liquidBalances: Map<string, number> },
  primaryAccountId: string | undefined,
  cashFlowTracking: CashFlowTracking[],
  taxCountry: string | undefined,
  inflationRate: number | undefined,
  currentMonth: Month,
  yearsElapsed: number,
  inflationAdjustment: InflationAdjustment,
): {
  income: number
  expenses: number
  incomeTax: number
  perCashFlow: Map<string, CashFlowItemResult>
} {
  let income = 0
  let expenses = 0
  let incomeTax = 0
  const perCashFlow = new Map<string, CashFlowItemResult>()

  for (const { cashFlow, resolvedStartDate, resolvedEndDate, accountId } of cashFlowTracking) {
    const shouldApply = cashFlow.isOneTime
      ? currentMonth === resolvedStartDate // One-time: only on exact date
      : isMonthInRange(currentMonth, resolvedStartDate, resolvedEndDate) // Recurring: within range
    if (!shouldApply) continue

    // monthlyAmount converts the stored amount to a monthly figure.
    let amount = cashFlow.monthlyAmount
    if (cashFlow.followsInflation && inflationRate && inflationRate !== 0) {
      amount = amount * Math.pow(1 + inflationRate / 100, yearsElapsed)
    }

    const targetId =
      accountId !== undefined && state.liquidBalances.has(accountId) ? accountId : primaryAccountId
    const targetBalance = targetId !== undefined ? (state.liquidBalances.get(targetId) ?? 0) : 0

    if (cashFlow.type === 'income') {
      income += amount
      let netIncome = amount
      if (cashFlow.incomeTaxId !== 'after-tax') {
        const taxOption = resolveTaxOption(cashFlow.incomeTaxId, taxCountry, 'income')
        if (taxOption) {
          const monthlyTax = calculateMonthlyIncomeTax(amount, taxOption, inflationAdjustment)
          incomeTax += monthlyTax
          netIncome -= monthlyTax
        }
      }
      if (targetId !== undefined) {
        state.liquidBalances.set(targetId, targetBalance + netIncome)
      }
    } else {
      expenses += amount
      if (targetId !== undefined) {
        state.liquidBalances.set(targetId, targetBalance - amount)
      }
    }

    perCashFlow.set(cashFlow.id, { amount, type: cashFlow.type })
  }

  return { income, expenses, incomeTax, perCashFlow }
}

/**
 * Group monthly projections by calendar year and build annual summaries.
 */
function buildAnnualSummaries(
  monthlyProjections: MonthlyProjection[],
  totalCapital: number,
  startingLiquidAssets: number,
  startingFixedAssets: number,
  initialTotalDebt: number,
): AnnualSummary[] {
  const annualSummaries: AnnualSummary[] = []

  // Group by year, recording the index of the first projection for each year.
  const yearGroups = new Map<number, { startIndex: number; projections: MonthlyProjection[] }>()

  monthlyProjections.forEach((projection, index) => {
    const year = parseInt(projection.date.split('-')[0] ?? '', 10)
    if (isNaN(year)) return
    let group = yearGroups.get(year)
    if (!group) {
      group = { startIndex: index, projections: [] }
      yearGroups.set(year, group)
    }
    group.projections.push(projection)
  })

  for (const [year, { startIndex, projections }] of Array.from(yearGroups.entries()).sort(
    (a, b) => a[0] - b[0],
  )) {
    if (projections.length === 0) continue

    const firstProjection = projections[0]
    const lastProjection = projections[projections.length - 1]
    if (!firstProjection || !lastProjection) continue

    // Starting balances come from the projection of the previous month.
    const previousProjection = startIndex > 0 ? monthlyProjections[startIndex - 1] : null

    const sum = (selector: (p: MonthlyProjection) => number) =>
      projections.reduce((acc, p) => acc + selector(p), 0)

    annualSummaries.push({
      year,
      age: firstProjection.age,
      startingBalance: previousProjection ? previousProjection.balance : totalCapital,
      startingLiquidAssets: previousProjection
        ? previousProjection.liquidAssets
        : startingLiquidAssets,
      startingFixedAssets: previousProjection
        ? previousProjection.fixedAssets
        : startingFixedAssets,
      startingTotalDebt: previousProjection ? previousProjection.totalDebt : initialTotalDebt,
      totalIncome: sum((p) => p.income),
      totalExpenses: sum((p) => p.expenses),
      totalDebtInterestPaid: sum((p) => p.debtInterestPaid),
      totalDebtPrincipalPaid: sum((p) => p.debtPrincipalPaid),
      totalIncomeTaxPaid: sum((p) => p.incomeTaxPaid),
      totalWealthTaxPaid: sum((p) => p.wealthTaxPaid),
      totalCapitalGainsTaxPaid: sum((p) => p.capitalGainsTaxPaid),
      totalTaxPaid: sum((p) => p.totalTaxPaid),
      endingBalance: lastProjection.balance,
      endingLiquidAssets: lastProjection.liquidAssets,
      endingFixedAssets: lastProjection.fixedAssets,
      endingTotalDebt: lastProjection.totalDebt,
    })
  }

  return annualSummaries
}

/**
 * Calculate financial projections from current date to the latest life event or age 90
 */
export function calculateProjections(profile: UserProfile): ProjectionResult {
  const startTime = performance.now()

  const { birthDate, capitalAccounts, liquidAssetsInterestRate, inflationRate } = profile
  const cashFlows = profile.cashFlows || []
  const debts = profile.debts || []

  const liquidAccounts = capitalAccounts.filter(
    (account): account is LiquidAsset => account instanceof LiquidAsset,
  )
  const fixedAccounts = capitalAccounts.filter(
    (account): account is FixedAsset => account instanceof FixedAsset,
  )

  const liquidInterestRate = liquidAssetsInterestRate ?? 5
  const primaryAccountId = profile.resolvePrimaryAccountId() ?? ''

  const projectionStart = getCurrentMonth()
  const fixedAssetTracking = buildFixedAssetTracking(fixedAccounts, profile)
  const { tracking: debtTracking, initialTotalDebt } = buildDebtTracking(
    debts,
    profile,
    projectionStart,
  )
  const cashFlowTracking = buildCashFlowTracking(cashFlows, profile)
  const liquidTrackings = buildLiquidAssetTracking(liquidAccounts)
  if (liquidTrackings.length === 0) {
    liquidTrackings.push({ id: primaryAccountId, amount: 0, balance: 0 })
  }

  // Mutable projection state shared across the monthly steps.
  const state = {
    liquidBalances: new Map(liquidTrackings.map((account) => [account.id, account.amount])),
    fixedAssets: fixedAssetTracking,
    debts: debtTracking,
  }

  const totalLiquidPrincipal = liquidAccounts.reduce((sum, account) => sum + account.amount, 0)
  const totalCapital =
    totalLiquidPrincipal +
    fixedAssetTracking.reduce((sum, asset) => sum + asset.balance, 0) -
    initialTotalDebt

  // End month: December of the year of the latest life event or fallback age 90.
  const simulationEndAge = getSimulationEndAge(profile)
  const endAgeMonth = addMonths(birthDate, simulationEndAge * 12)
  const endYear = Math.floor(endAgeMonth / 12) + 1900
  const endMonth = (endYear - 1900) * 12 + 11 // December = month index 11
  const monthsFromNow = monthDiff(endMonth, projectionStart) + 1

  const monthlyProjections: MonthlyProjection[] = []

  // Per-item snapshot collectors, keyed by item id.
  const itemSnapshots = new Map<string, ItemMonthlySnapshot[]>()

  // Fixed assets stop recording once liquidated; track which are done.
  const liquidatedFixed = new Set<string>()

  for (let monthIndex = 0; monthIndex < monthsFromNow; monthIndex++) {
    const currentMonth = addMonths(projectionStart, monthIndex)
    const age = profile.getAgeAt(currentMonth)

    const inflationAdjustment: InflationAdjustment = {
      inflationRate: inflationRate ?? 0,
      monthsSinceReference: monthIndex,
    }

    const { capitalGainsTax, wealthTax, liquidatedIds } = applyAssetGrowthAndTaxes(
      state,
      liquidTrackings,
      primaryAccountId,
      liquidInterestRate,
      profile.taxCountry,
      currentMonth,
      inflationAdjustment,
    )

    const { debtInterest, debtPrincipal, perDebt } = processDebtPayments(
      state,
      primaryAccountId,
      currentMonth,
    )

    const { income, expenses, incomeTax, perCashFlow } = processCashFlows(
      state,
      primaryAccountId,
      cashFlowTracking,
      profile.taxCountry,
      inflationRate,
      currentMonth,
      monthIndex / 12,
      inflationAdjustment,
    )

    const fixedAssetsTotal = state.fixedAssets.reduce((sum, asset) => sum + asset.balance, 0)
    const totalDebt = state.debts.reduce((sum, d) => sum + d.balance, 0)
    const totalLiquidAssets = Array.from(state.liquidBalances.values()).reduce(
      (sum, b) => sum + b,
      0,
    )

    monthlyProjections.push({
      date: formatMonth(currentMonth, 'YYYY-MM'),
      age,
      balance: totalLiquidAssets + fixedAssetsTotal - totalDebt,
      liquidAssets: totalLiquidAssets,
      fixedAssets: fixedAssetsTotal,
      totalDebt,
      income,
      expenses,
      debtInterestPaid: debtInterest,
      debtPrincipalPaid: debtPrincipal,
      incomeTaxPaid: incomeTax,
      wealthTaxPaid: wealthTax,
      capitalGainsTaxPaid: capitalGainsTax,
      totalTaxPaid: incomeTax + wealthTax + capitalGainsTax,
    })

    // --- Record per-item snapshots for the timeline scrubber ---

    // Liquid assets: always active; use their specific balance from the map.
    for (const account of liquidAccounts) {
      let snapshots = itemSnapshots.get(account.id)
      if (!snapshots) {
        snapshots = []
        itemSnapshots.set(account.id, snapshots)
      }
      snapshots.push({
        itemId: account.id,
        monthOffset: monthIndex,
        balance: state.liquidBalances.get(account.id) ?? 0,
        inflow: 0,
        outflow: 0,
        interestPaid: 0,
        principalPaid: 0,
        liquidated: false,
      })
    }

    // Fixed assets: record until liquidated (inclusive), then stop.
    for (const asset of state.fixedAssets) {
      const wasLiquidated = liquidatedIds.has(asset.id)
      if (liquidatedFixed.has(asset.id) && !wasLiquidated) continue

      let snapshots = itemSnapshots.get(asset.id)
      if (!snapshots) {
        snapshots = []
        itemSnapshots.set(asset.id, snapshots)
      }
      snapshots.push({
        itemId: asset.id,
        monthOffset: monthIndex,
        balance: asset.balance,
        inflow: 0,
        outflow: 0,
        interestPaid: 0,
        principalPaid: 0,
        liquidated: wasLiquidated,
      })

      if (wasLiquidated) liquidatedFixed.add(asset.id)
    }

    // Debts: record every month until paid off (inclusive of the payoff month).
    for (const tracking of state.debts) {
      const payment = perDebt.get(tracking.debt.id)
      // Keep recording while the debt still has a balance, or this is the payoff month.
      if (tracking.isPaidOff && tracking.balance <= 0 && !payment) continue

      let snapshots = itemSnapshots.get(tracking.debt.id)
      if (!snapshots) {
        snapshots = []
        itemSnapshots.set(tracking.debt.id, snapshots)
      }
      snapshots.push({
        itemId: tracking.debt.id,
        monthOffset: monthIndex,
        balance: tracking.balance,
        inflow: 0,
        outflow: 0,
        interestPaid: payment?.interest ?? 0,
        principalPaid: payment?.principal ?? 0,
        liquidated: false,
      })
    }

    // Cash flows: record only on months where they apply.
    for (const [cashFlowId, result] of perCashFlow) {
      let snapshots = itemSnapshots.get(cashFlowId)
      if (!snapshots) {
        snapshots = []
        itemSnapshots.set(cashFlowId, snapshots)
      }
      snapshots.push({
        itemId: cashFlowId,
        monthOffset: monthIndex,
        balance: 0,
        inflow: result.type === 'income' ? result.amount : 0,
        outflow: result.type === 'expense' ? result.amount : 0,
        interestPaid: 0,
        principalPaid: 0,
        liquidated: false,
      })
    }
  }

  const annualSummaries = buildAnnualSummaries(
    monthlyProjections,
    totalCapital,
    totalLiquidPrincipal,
    fixedAccounts.reduce((sum, account) => sum + account.amount, 0),
    initialTotalDebt,
  )

  const itemProjections: ItemProjection[] = []
  for (const [itemId, snapshots] of itemSnapshots) {
    itemProjections.push({ itemId, snapshots })
  }

  return {
    monthlyProjections,
    annualSummaries,
    itemProjections,
    calculationTimeMs: performance.now() - startTime,
  }
}
