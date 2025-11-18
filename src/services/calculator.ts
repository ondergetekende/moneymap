/**
 * Financial projection calculation engine
 */

import type {
  UserProfile,
  MonthlyProjection,
  AnnualSummary,
  ProjectionResult,
} from '@/models'
import { LiquidAsset, FixedAsset } from '@/models'
import type { Month } from '@/types/month'
import { getCurrentMonth, addMonths, formatMonth, monthDiff } from '@/types/month'

const MAX_AGE = 100

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
 * Calculate financial projections from current date to age 100
 */
export function calculateProjections(profile: UserProfile): ProjectionResult {
  const startTime = performance.now()

  const { birthDate, capitalAccounts, liquidAssetsInterestRate, inflationRate } = profile
  // Support both legacy 'expenses' and new 'cashFlows' field
  const cashFlows = profile.cashFlows || []
  const debts = profile.debts || []

  // Separate liquid and fixed assets
  const liquidAccounts = capitalAccounts.filter((account) => account instanceof LiquidAsset)
  const fixedAccounts = capitalAccounts.filter((account) => account instanceof FixedAsset)

  // Use the global liquid assets interest rate (default to 5% if not set)
  const liquidInterestRate = liquidAssetsInterestRate ?? 5

  // Initialize liquid assets pool (all liquid accounts combined)
  let liquidAssetsBalance = liquidAccounts.reduce((sum, account) => sum + account.amount, 0)

  // Track each fixed asset separately with its own rate
  const fixedAssetBalances = fixedAccounts.map((account) => ({
    ...account,
    balance: account.amount,
  }))

  const monthlyProjections: MonthlyProjection[] = []

  // Start from the beginning of current month
  const projectionStart = getCurrentMonth()

  // Track each debt separately with its current balance
  // For debts that started in the past, calculate the balance at simulation start
  const debtBalances = debts.map((debt) => {
    let currentBalance = debt.amount

    // If debt has a start date in the past, calculate how much would have been paid off
    const debtStartMonth = debt.startDate
    const repaymentStartMonth = debt.repaymentStartDate ?? debtStartMonth

    if (repaymentStartMonth !== undefined && repaymentStartMonth < projectionStart) {
      // Calculate months between repayment start and simulation start
      const monthsPassed = monthDiff(projectionStart, repaymentStartMonth)

      if (monthsPassed > 0) {
        // Use the debt's calculateProjectedBalance to determine current balance
        currentBalance = debt.calculateProjectedBalance(debt.amount, monthsPassed)
      }
    }

    return {
      debt,
      balance: currentBalance,
      isPaidOff: currentBalance <= 0,
    }
  })

  // Store initial debt total before it gets mutated
  const initialTotalDebt = debtBalances.reduce((sum, d) => sum + d.balance, 0)

  // Calculate total starting capital (net worth = assets - debts)
  const totalCapital =
    liquidAssetsBalance +
    fixedAssetBalances.reduce((sum, asset) => sum + asset.balance, 0) -
    initialTotalDebt

  // Calculate end month (when user turns 100)
  const endMonth = addMonths(birthDate, MAX_AGE * 12)

  // Calculate total months from now until age 100
  const monthsFromNow = monthDiff(endMonth, projectionStart)

  for (let monthIndex = 0; monthIndex < monthsFromNow; monthIndex++) {
    const currentMonth = addMonths(projectionStart, monthIndex)

    const age = profile.getAgeAt(currentMonth)

    // Apply interest to liquid assets pool (shared rate)
    const liquidMonthlyRate = liquidInterestRate / 100 / 12
    const liquidInterest = liquidAssetsBalance * liquidMonthlyRate
    liquidAssetsBalance += liquidInterest

    // Apply appreciation/depreciation to each fixed asset individually
    for (const asset of fixedAssetBalances) {
      const monthlyRate = asset.annualInterestRate / 100 / 12
      const valueChange = asset.balance * monthlyRate
      asset.balance += valueChange

      // Check for liquidation at start of month (after appreciation for this month)
      if (asset.liquidationDate !== undefined && currentMonth >= asset.liquidationDate && asset.balance > 0) {
        // Transfer asset value to liquid assets
        liquidAssetsBalance += asset.balance
        // Set asset balance to 0 for rest of projection
        asset.balance = 0
      }
    }

    // Process debt payments (after interest on liquid assets)
    let monthlyDebtInterest = 0
    let monthlyDebtPrincipal = 0

    for (const debtTracking of debtBalances) {
      // Skip if debt is already paid off (balance is zero or less)
      if (debtTracking.balance <= 0) {
        debtTracking.balance = 0
        debtTracking.isPaidOff = true
        continue
      }

      // Skip if debt is marked as paid off but still has a remaining balance (e.g., finalBalance > 0)
      if (debtTracking.isPaidOff) {
        continue
      }

      const debt = debtTracking.debt

      // Check if we've reached or passed the end month - trigger final payment
      if (debt.endDate !== undefined) {
        // If current month is at or after end month, trigger final payment
        if (currentMonth >= debt.endDate) {
          // Use the debt's calculateMonthlyPayment with monthsRemaining=1 to get final payment
          const payment = debt.calculateMonthlyPayment(debtTracking.balance, 1)

          // Check if sufficient liquid assets to make payment
          if (liquidAssetsBalance >= payment.totalPayment) {
            liquidAssetsBalance -= payment.totalPayment
            debtTracking.balance -= payment.principal
            monthlyDebtInterest += payment.interest
            monthlyDebtPrincipal += payment.principal

            // Ensure balance doesn't go below finalBalance
            debtTracking.balance = Math.max(debtTracking.balance, debt.finalBalance ?? 0)

            // Mark as paid off only if balance is zero
            if (debtTracking.balance <= 0) {
              debtTracking.balance = 0
              debtTracking.isPaidOff = true
            }
          }
          continue
        }
      }

      // Check if repayment is active at this month
      if (!debt.isRepaymentActive(currentMonth)) {
        continue
      }

      // Calculate months remaining until end month (if specified)
      let monthsRemaining: number | undefined
      if (debt.endDate !== undefined) {
        const monthsDiff = monthDiff(debt.endDate, currentMonth)
        monthsRemaining = Math.max(1, monthsDiff)
      }

      // Delegate payment calculation to the debt model
      const payment = debt.calculateMonthlyPayment(debtTracking.balance, monthsRemaining)

      // Check if sufficient liquid assets to make payment
      if (liquidAssetsBalance >= payment.totalPayment) {
        liquidAssetsBalance -= payment.totalPayment
        debtTracking.balance -= payment.principal
        monthlyDebtInterest += payment.interest
        monthlyDebtPrincipal += payment.principal

        // Mark as paid off if balance is zero or negative
        if (debtTracking.balance <= 0) {
          debtTracking.balance = 0
          debtTracking.isPaidOff = true
        }
      }
      // If insufficient funds, skip payment (debt remains)
    }

    // Calculate income and expenses for this month
    let monthlyIncome = 0
    let monthlyExpenses = 0

    // Calculate years elapsed since projection start for inflation adjustment
    const yearsElapsed = monthIndex / 12

    for (const cashFlow of cashFlows) {
      // Handle one-time transactions differently from recurring ones
      const shouldApply = cashFlow.isOneTime
        ? currentMonth === cashFlow.startDate  // One-time: only on exact date
        : isMonthInRange(currentMonth, cashFlow.startDate, cashFlow.endDate)  // Recurring: within date range

      if (shouldApply) {
        // Apply inflation adjustment if enabled for this cash flow
        let amount = cashFlow.monthlyAmount
        if (cashFlow.followsInflation && inflationRate !== undefined && inflationRate !== 0) {
          // Compound inflation: amount × (1 + rate/100)^years
          amount = cashFlow.monthlyAmount * Math.pow(1 + inflationRate / 100, yearsElapsed)
        }

        if (cashFlow.type === 'income') {
          monthlyIncome += amount
        } else {
          monthlyExpenses += amount
        }
      }
    }

    // All cash flows interact with liquid assets only
    const netCashFlow = monthlyIncome - monthlyExpenses
    liquidAssetsBalance += netCashFlow

    // Calculate totals
    const fixedAssetsTotal = fixedAssetBalances.reduce((sum, asset) => sum + asset.balance, 0)
    const totalDebt = debtBalances.reduce((sum, d) => sum + d.balance, 0)
    const currentBalance = liquidAssetsBalance + fixedAssetsTotal - totalDebt

    monthlyProjections.push({
      date: formatMonth(currentMonth, 'YYYY-MM'),
      age,
      balance: currentBalance,
      liquidAssets: liquidAssetsBalance,
      fixedAssets: fixedAssetsTotal,
      totalDebt,
      income: monthlyIncome,
      expenses: monthlyExpenses,
      debtInterestPaid: monthlyDebtInterest,
      debtPrincipalPaid: monthlyDebtPrincipal,
    })
  }

  // Aggregate into annual summaries
  const annualSummaries: AnnualSummary[] = []

  // Group by year
  const yearGroups = new Map<number, MonthlyProjection[]>()

  for (const projection of monthlyProjections) {
    const dateParts = projection.date.split('-')
    if (dateParts[0]) {
      const year = parseInt(dateParts[0], 10)
      if (!yearGroups.has(year)) {
        yearGroups.set(year, [])
      }
      yearGroups.get(year)?.push(projection)
    }
  }

  // Create annual summaries
  for (const [year, projections] of Array.from(yearGroups.entries()).sort((a, b) => a[0] - b[0])) {
    if (projections.length === 0) continue

    const firstProjection = projections[0]
    const lastProjection = projections[projections.length - 1]

    if (!firstProjection || !lastProjection) continue

    // Find the projection from the previous month for starting balances
    const yearMonth = `${year}-01`
    const projectionIndex = monthlyProjections.findIndex((p) => p.date === yearMonth)
    const previousProjection = projectionIndex > 0 ? monthlyProjections[projectionIndex - 1] : null

    const startingBalance = previousProjection ? previousProjection.balance : totalCapital
    const startingLiquidAssets = previousProjection
      ? previousProjection.liquidAssets
      : liquidAccounts.reduce((sum, account) => sum + account.amount, 0)
    const startingFixedAssets = previousProjection
      ? previousProjection.fixedAssets
      : fixedAccounts.reduce((sum, account) => sum + account.amount, 0)
    const startingTotalDebt = previousProjection
      ? previousProjection.totalDebt
      : initialTotalDebt

    const totalIncome = projections.reduce((sum, p) => sum + p.income, 0)
    const totalExpenses = projections.reduce((sum, p) => sum + p.expenses, 0)
    const totalDebtInterestPaid = projections.reduce((sum, p) => sum + p.debtInterestPaid, 0)
    const totalDebtPrincipalPaid = projections.reduce((sum, p) => sum + p.debtPrincipalPaid, 0)
    const endingBalance = lastProjection.balance
    const endingLiquidAssets = lastProjection.liquidAssets
    const endingFixedAssets = lastProjection.fixedAssets
    const endingTotalDebt = lastProjection.totalDebt

    annualSummaries.push({
      year,
      age: firstProjection.age,
      startingBalance,
      startingLiquidAssets,
      startingFixedAssets,
      startingTotalDebt,
      totalIncome,
      totalExpenses,
      totalDebtInterestPaid,
      totalDebtPrincipalPaid,
      endingBalance,
      endingLiquidAssets,
      endingFixedAssets,
      endingTotalDebt,
    })
  }

  const endTime = performance.now()
  const calculationTimeMs = endTime - startTime

  return {
    monthlyProjections,
    annualSummaries,
    calculationTimeMs,
  }
}
