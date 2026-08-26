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
    liquidBalance: number
    fixedAssets: FixedAssetTracking[]
  },
  liquidAccounts: LiquidAsset[],
  totalLiquidPrincipal: number,
  liquidInterestRate: number,
  taxCountry: string | undefined,
  currentMonth: Month,
  inflationAdjustment: InflationAdjustment,
): { capitalGainsTax: number; wealthTax: number; liquidatedIds: Set<string> } {
  let capitalGainsTax = 0
  let wealthTax = 0
  const liquidatedIds = new Set<string>()

  // Apply interest to the shared liquid assets pool.
  const liquidMonthlyRate = liquidInterestRate / 100 / 12
  const liquidInterest = state.liquidBalance * liquidMonthlyRate
  state.liquidBalance += liquidInterest

  // Capital gains tax on the liquid interest, proportional to each account's share.
  if (liquidInterest > 0) {
    for (const account of liquidAccounts) {
      const taxOption = resolveTaxOption(account.capitalGainsTaxId, taxCountry, 'capital_gains')
      if (!taxOption) continue

      const accountShare = totalLiquidPrincipal > 0 ? account.amount / totalLiquidPrincipal : 0
      const accountInterest = liquidInterest * accountShare
      const annualTax = calculateTax(accountInterest * 12, taxOption, inflationAdjustment)
      capitalGainsTax += annualTax / 12
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
    if (taxOption && totalGain > 0) {
      capitalGainsTax += calculateTax(totalGain, taxOption, inflationAdjustment)
    }

    // Transfer the liquidated value into the liquid pool.
    state.liquidBalance += asset.balance
    asset.balance = 0
    liquidatedIds.add(asset.id)
  }

  // Deduct capital gains tax from liquid assets.
  state.liquidBalance -= capitalGainsTax

  // Wealth tax on liquid assets (proportional share of the current pool).
  for (const account of liquidAccounts) {
    const taxOption = resolveTaxOption(account.wealthTaxId, taxCountry, 'wealth')
    if (!taxOption) continue

    const accountShare = totalLiquidPrincipal > 0 ? account.amount / totalLiquidPrincipal : 0
    const accountValue = state.liquidBalance * accountShare
    wealthTax += calculateTax(accountValue, taxOption, inflationAdjustment) / 12
  }

  // Wealth tax on fixed assets.
  for (const asset of state.fixedAssets) {
    if (asset.balance <= 0) continue
    const taxOption = resolveTaxOption(asset.wealthTaxId, taxCountry, 'wealth')
    if (!taxOption) continue
    wealthTax += calculateTax(asset.balance, taxOption, inflationAdjustment) / 12
  }

  state.liquidBalance -= wealthTax
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
  state: { liquidBalance: number; debts: DebtTracking[] },
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

    // At or after the end date: make the final balloon payment.
    if (tracking.resolvedEndDate !== undefined && currentMonth >= tracking.resolvedEndDate) {
      const payment = debt.calculateMonthlyPayment(tracking.balance, 1)
      if (state.liquidBalance >= payment.totalPayment) {
        state.liquidBalance -= payment.totalPayment
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
    // Skip when there are not enough liquid assets to cover the payment.
    if (state.liquidBalance < payment.totalPayment) continue

    state.liquidBalance -= payment.totalPayment
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
 * keyed by cash-flow id for item snapshots. Income tax is deducted from the
 * liquid balance here; the net cash flow is left for the caller to apply.
 */
function processCashFlows(
  state: { liquidBalance: number },
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

  for (const { cashFlow, resolvedStartDate, resolvedEndDate } of cashFlowTracking) {
    const shouldApply = cashFlow.isOneTime
      ? currentMonth === resolvedStartDate // One-time: only on exact date
      : isMonthInRange(currentMonth, resolvedStartDate, resolvedEndDate) // Recurring: within range
    if (!shouldApply) continue

    // monthlyAmount converts the stored amount to a monthly figure.
    let amount = cashFlow.monthlyAmount
    if (cashFlow.followsInflation && inflationRate && inflationRate !== 0) {
      amount = amount * Math.pow(1 + inflationRate / 100, yearsElapsed)
    }

    if (cashFlow.type === 'income') {
      income += amount
      if (cashFlow.incomeTaxId !== 'after-tax') {
        const taxOption = resolveTaxOption(cashFlow.incomeTaxId, taxCountry, 'income')
        if (taxOption) {
          incomeTax += calculateMonthlyIncomeTax(amount, taxOption, inflationAdjustment)
        }
      }
    } else {
      expenses += amount
    }

    perCashFlow.set(cashFlow.id, { amount, type: cashFlow.type })
  }

  state.liquidBalance -= incomeTax
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
  const totalLiquidPrincipal = liquidAccounts.reduce((sum, account) => sum + account.amount, 0)

  const projectionStart = getCurrentMonth()
  const fixedAssetTracking = buildFixedAssetTracking(fixedAccounts, profile)
  const { tracking: debtTracking, initialTotalDebt } = buildDebtTracking(
    debts,
    profile,
    projectionStart,
  )
  const cashFlowTracking = buildCashFlowTracking(cashFlows, profile)

  // Mutable projection state shared across the monthly steps.
  const state = {
    liquidBalance: totalLiquidPrincipal,
    fixedAssets: fixedAssetTracking,
    debts: debtTracking,
  }

  const totalCapital =
    state.liquidBalance +
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
  const liquidShare = (account: LiquidAsset) =>
    totalLiquidPrincipal > 0 ? account.amount / totalLiquidPrincipal : 0

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
      liquidAccounts,
      totalLiquidPrincipal,
      liquidInterestRate,
      profile.taxCountry,
      currentMonth,
      inflationAdjustment,
    )

    const { debtInterest, debtPrincipal, perDebt } = processDebtPayments(state, currentMonth)

    const { income, expenses, incomeTax, perCashFlow } = processCashFlows(
      state,
      cashFlowTracking,
      profile.taxCountry,
      inflationRate,
      currentMonth,
      monthIndex / 12,
      inflationAdjustment,
    )

    // Apply net cash flow to the liquid pool.
    state.liquidBalance += income - expenses

    const fixedAssetsTotal = state.fixedAssets.reduce((sum, asset) => sum + asset.balance, 0)
    const totalDebt = state.debts.reduce((sum, d) => sum + d.balance, 0)

    monthlyProjections.push({
      date: formatMonth(currentMonth, 'YYYY-MM'),
      age,
      balance: state.liquidBalance + fixedAssetsTotal - totalDebt,
      liquidAssets: state.liquidBalance,
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

    // Liquid assets: always active; balance is their share of the liquid pool.
    for (const account of liquidAccounts) {
      let snapshots = itemSnapshots.get(account.id)
      if (!snapshots) {
        snapshots = []
        itemSnapshots.set(account.id, snapshots)
      }
      snapshots.push({
        itemId: account.id,
        monthOffset: monthIndex,
        balance: state.liquidBalance * liquidShare(account),
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
