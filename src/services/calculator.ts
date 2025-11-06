/**
 * Financial projection calculation engine
 */

import type {
  UserProfile,
  MonthlyProjection,
  AnnualSummary,
  ProjectionResult,
} from '@/types/models'

const MAX_AGE = 100

/**
 * Calculate age at a given date
 */
function calculateAge(birthDate: string, atDate: Date): number {
  const birth = new Date(birthDate)
  let age = atDate.getFullYear() - birth.getFullYear()
  const monthDiff = atDate.getMonth() - birth.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && atDate.getDate() < birth.getDate())) {
    age--
  }
  return age
}

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

  const { birthDate, capitalAccounts } = profile
  // Support both legacy 'expenses' and new 'cashFlows' field
  const cashFlows = profile.cashFlows || []

  // Calculate total starting capital
  const totalCapital = capitalAccounts.reduce((sum, account) => sum + account.amount, 0)

  const monthlyProjections: MonthlyProjection[] = []

  // Track each capital account balance separately for interest calculations
  const accountBalances = capitalAccounts.map((account) => ({
    ...account,
    balance: account.amount,
  }))

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

    const age = calculateAge(birthDate, currentDate)

    // Apply interest to each account first (compound monthly on starting balance)
    for (const account of accountBalances) {
      // Calculate monthly interest rate from annual rate
      const monthlyRate = account.annualInterestRate / 100 / 12
      const interestEarned = account.balance * monthlyRate
      account.balance += interestEarned
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

    // Apply cash flows proportionally to accounts based on their balances
    // (positive cash flow distributed proportionally, negative withdrawn proportionally)
    const netCashFlow = monthlyIncome - monthlyExpenses
    const totalAccountBalance = accountBalances.reduce((sum, a) => sum + a.balance, 0)

    if (totalAccountBalance > 0) {
      for (const account of accountBalances) {
        const accountProportion = account.balance / totalAccountBalance
        account.balance += netCashFlow * accountProportion
      }
    } else {
      // If total balance is zero or negative, apply cash flow to first account
      const firstAccount = accountBalances[0]
      if (firstAccount) {
        firstAccount.balance += netCashFlow
      }
    }

    // Calculate final balance
    const currentBalance = accountBalances.reduce((sum, account) => sum + account.balance, 0)

    monthlyProjections.push({
      date: formatYearMonth(currentDate),
      age,
      balance: currentBalance,
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

    // Find the projection from the previous month for starting balance
    const yearMonth = `${year}-01`
    const projectionIndex = monthlyProjections.findIndex((p) => p.date === yearMonth)
    const previousProjection = projectionIndex > 0 ? monthlyProjections[projectionIndex - 1] : null
    const startingBalance = previousProjection ? previousProjection.balance : totalCapital

    const totalIncome = projections.reduce((sum, p) => sum + p.income, 0)
    const totalExpenses = projections.reduce((sum, p) => sum + p.expenses, 0)
    const endingBalance = lastProjection.balance

    annualSummaries.push({
      year,
      age: firstProjection.age,
      startingBalance,
      totalIncome,
      totalExpenses,
      endingBalance,
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
