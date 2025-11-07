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

const MAX_AGE = 100

/**
 * Check if a date is within a range (inclusive start, exclusive end)
 * If startDate is missing, treats as "from the beginning"
 * If endDate is missing, treats as "forever"
 */
function isDateInRange(date: Date, startDate?: string, endDate?: string): boolean {
  if (!startDate && !endDate) {
    return true // No date constraints, always active
  }

  if (!startDate) {
    // Only end date specified - active until end date
    const end = new Date(endDate!)
    return date < end
  }

  if (!endDate) {
    // Only start date specified - active from start date onwards
    const start = new Date(startDate)
    return date >= start
  }

  // Both dates specified - traditional range check
  const start = new Date(startDate)
  const end = new Date(endDate)
  return date >= start && date < end
}

/**
 * Format date as YYYY-MM
 */
function formatYearMonth(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

/**
 * Calculate financial projections from current date to age 100
 */
export function calculateProjections(profile: UserProfile): ProjectionResult {
  const startTime = performance.now()

  const { birthDate, capitalAccounts, liquidAssetsInterestRate } = profile
  // Support both legacy 'expenses' and new 'cashFlows' field
  const cashFlows = profile.cashFlows || []

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

  // Calculate total starting capital
  const totalCapital =
    liquidAssetsBalance + fixedAssetBalances.reduce((sum, asset) => sum + asset.balance, 0)

  const monthlyProjections: MonthlyProjection[] = []

  // Start from today
  const today = new Date()

  // Calculate end date (when user turns 100)
  const birth = new Date(birthDate)
  const endDate = new Date(birth.getFullYear() + MAX_AGE, birth.getMonth(), birth.getDate())

  // Calculate total months from now until age 100
  const monthsFromNow =
    (endDate.getFullYear() - today.getFullYear()) * 12 + (endDate.getMonth() - today.getMonth())

  // Start from the beginning of current month
  const projectionStart = new Date(today.getFullYear(), today.getMonth(), 1)

  for (let monthIndex = 0; monthIndex < monthsFromNow; monthIndex++) {
    const currentDate = new Date(
      projectionStart.getFullYear(),
      projectionStart.getMonth() + monthIndex,
      1,
    )

    const age = profile.getAgeAt(currentDate)

    // Apply interest to liquid assets pool (shared rate)
    const liquidMonthlyRate = liquidInterestRate / 100 / 12
    const liquidInterest = liquidAssetsBalance * liquidMonthlyRate
    liquidAssetsBalance += liquidInterest

    // Apply appreciation/depreciation to each fixed asset individually
    for (const asset of fixedAssetBalances) {
      const monthlyRate = asset.annualInterestRate / 100 / 12
      const valueChange = asset.balance * monthlyRate
      asset.balance += valueChange
    }

    // Calculate income and expenses for this month
    let monthlyIncome = 0
    let monthlyExpenses = 0

    for (const cashFlow of cashFlows) {
      if (isDateInRange(currentDate, cashFlow.startDate, cashFlow.endDate)) {
        if (cashFlow.type === 'income') {
          monthlyIncome += cashFlow.monthlyAmount
        } else {
          monthlyExpenses += cashFlow.monthlyAmount
        }
      }
    }

    // All cash flows interact with liquid assets only
    const netCashFlow = monthlyIncome - monthlyExpenses
    liquidAssetsBalance += netCashFlow

    // Calculate totals
    const fixedAssetsTotal = fixedAssetBalances.reduce((sum, asset) => sum + asset.balance, 0)
    const currentBalance = liquidAssetsBalance + fixedAssetsTotal

    monthlyProjections.push({
      date: formatYearMonth(currentDate),
      age,
      balance: currentBalance,
      liquidAssets: liquidAssetsBalance,
      fixedAssets: fixedAssetsTotal,
      income: monthlyIncome,
      expenses: monthlyExpenses,
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

    const totalIncome = projections.reduce((sum, p) => sum + p.income, 0)
    const totalExpenses = projections.reduce((sum, p) => sum + p.expenses, 0)
    const endingBalance = lastProjection.balance
    const endingLiquidAssets = lastProjection.liquidAssets
    const endingFixedAssets = lastProjection.fixedAssets

    annualSummaries.push({
      year,
      age: firstProjection.age,
      startingBalance,
      startingLiquidAssets,
      startingFixedAssets,
      totalIncome,
      totalExpenses,
      endingBalance,
      endingLiquidAssets,
      endingFixedAssets,
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
