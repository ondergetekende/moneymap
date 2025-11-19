/**
 * Tax Calculator Service
 *
 * Provides functions for calculating taxes based on tax configurations.
 * Supports both flat rates and progressive bracket systems.
 */

import {
  type TaxOption,
  type TaxType,
  type TaxBracket,
  type InflationAdjustment,
  getDefaultTaxOption,
  findTaxOption
} from '../config/taxConfig'

// Re-export for use by calculator
export type { InflationAdjustment }

/**
 * Adjust an amount for inflation
 *
 * @param amount - The base amount to adjust
 * @param inflationAdjustment - Inflation adjustment parameters (optional)
 * @returns The inflation-adjusted amount
 */
function adjustForInflation(
  amount: number,
  inflationAdjustment?: InflationAdjustment
): number {
  if (!inflationAdjustment || inflationAdjustment.monthsSinceReference <= 0) {
    return amount
  }

  // Calculate cumulative inflation: (1 + rate)^years
  const years = inflationAdjustment.monthsSinceReference / 12
  const inflationMultiplier = Math.pow(
    1 + inflationAdjustment.inflationRate / 100,
    years
  )

  return amount * inflationMultiplier
}

/**
 * Calculate tax amount based on a tax option configuration
 *
 * @param amount - The amount to calculate tax on (gross income, asset value, gains, etc.)
 * @param taxOption - The tax configuration to apply
 * @param inflationAdjustment - Optional inflation adjustment parameters for brackets and thresholds
 * @returns The calculated tax amount
 */
export function calculateTax(
  amount: number,
  taxOption: TaxOption,
  inflationAdjustment?: InflationAdjustment
): number {
  // Negative or zero amounts have no tax
  if (amount <= 0) {
    return 0
  }

  // Handle exemption threshold with inflation adjustment
  if (taxOption.exemptionThreshold !== undefined) {
    const adjustedThreshold = adjustForInflation(
      taxOption.exemptionThreshold,
      inflationAdjustment
    )
    if (amount <= adjustedThreshold) {
      return 0
    }
    // Only the amount above the threshold is taxable
    amount = amount - adjustedThreshold
  }

  // Flat rate calculation (no bracket adjustment needed)
  if (taxOption.rate !== undefined) {
    return amount * (taxOption.rate / 100)
  }

  // Progressive brackets calculation with inflation adjustment
  if (taxOption.brackets && taxOption.brackets.length > 0) {
    return calculateProgressiveTax(amount, taxOption.brackets, inflationAdjustment)
  }

  // No rate or brackets defined, no tax
  return 0
}

/**
 * Calculate tax using progressive brackets
 *
 * @param amount - The taxable amount
 * @param brackets - Array of tax brackets (should be sorted by threshold ascending)
 * @param inflationAdjustment - Optional inflation adjustment parameters for bracket thresholds
 * @returns The calculated tax amount
 */
export function calculateProgressiveTax(
  amount: number,
  brackets: TaxBracket[],
  inflationAdjustment?: InflationAdjustment
): number {
  if (amount <= 0) return 0
  if (brackets.length === 0) return 0

  // Adjust bracket thresholds for inflation
  const adjustedBrackets = brackets.map(bracket => ({
    ...bracket,
    threshold: adjustForInflation(bracket.threshold, inflationAdjustment)
  }))

  // Ensure brackets are sorted by threshold
  const sortedBrackets = adjustedBrackets.sort((a, b) => a.threshold - b.threshold)

  let totalTax = 0

  for (let i = 0; i < sortedBrackets.length; i++) {
    const currentBracket = sortedBrackets[i]
    if (!currentBracket) continue // Type guard (should never happen)

    const nextBracket = sortedBrackets[i + 1]

    // Amount in this bracket
    if (amount <= currentBracket.threshold) {
      // Amount doesn't reach this bracket
      break
    }

    let taxableInBracket: number
    if (nextBracket) {
      // There's a next bracket
      if (amount <= nextBracket.threshold) {
        // Amount is in this bracket but doesn't reach the next
        taxableInBracket = amount - currentBracket.threshold
      } else {
        // Amount reaches the next bracket
        taxableInBracket = nextBracket.threshold - currentBracket.threshold
      }
    } else {
      // This is the highest bracket
      taxableInBracket = amount - currentBracket.threshold
    }

    totalTax += taxableInBracket * (currentBracket.rate / 100)
  }

  return totalTax
}

/**
 * Resolve a tax option from a tax ID and country code
 *
 * Handles special cases:
 * - 'default': Returns the default tax option for the country and type
 * - 'after-tax': Returns null (no tax applied)
 * - 'none': Returns null (no tax applied)
 * - undefined: Returns null (no tax configured)
 *
 * @param taxId - The tax ID to resolve
 * @param countryCode - The country code
 * @param taxType - The type of tax (income, wealth, capital_gains)
 * @returns The resolved tax option, or null if no tax should be applied
 */
export function resolveTaxOption(
  taxId: string | undefined,
  countryCode: string | undefined,
  taxType: TaxType
): TaxOption | null {
  // No tax ID configured
  if (!taxId) {
    return null
  }

  // Special case: no tax
  if (taxId === 'none' || taxId === 'after-tax') {
    return null
  }

  // Special case: use default for country
  if (taxId === 'default') {
    if (!countryCode) {
      console.warn('Cannot resolve default tax without country code')
      return null
    }
    const defaultOption = getDefaultTaxOption(countryCode, taxType)
    if (!defaultOption) {
      console.warn(
        `No default ${taxType} tax option found for country ${countryCode}`
      )
      return null
    }
    return defaultOption
  }

  // Look up specific tax option
  const taxOption = findTaxOption(taxId, countryCode)
  if (!taxOption) {
    console.warn(
      `Tax option not found: ${taxId} for country ${countryCode || 'any'}`
    )
    return null
  }

  // Verify the tax option type matches what we're looking for
  if (taxOption.type !== taxType) {
    console.warn(
      `Tax option ${taxId} is type ${taxOption.type}, expected ${taxType}`
    )
    return null
  }

  return taxOption
}

/**
 * Calculate annual tax and convert to monthly
 *
 * Helper function for taxes that are typically calculated annually
 * but need to be applied monthly in projections.
 *
 * @param annualAmount - The annual taxable amount
 * @param taxOption - The tax configuration
 * @param inflationAdjustment - Optional inflation adjustment parameters
 * @returns The monthly tax amount
 */
export function calculateMonthlyTax(
  annualAmount: number,
  taxOption: TaxOption,
  inflationAdjustment?: InflationAdjustment
): number {
  const annualTax = calculateTax(annualAmount, taxOption, inflationAdjustment)
  return annualTax / 12
}

/**
 * Calculate tax on monthly income
 *
 * For income tax, we need to annualize the monthly income first,
 * calculate the annual tax, then divide by 12 to get the monthly tax.
 * This ensures progressive brackets work correctly.
 *
 * @param monthlyIncome - The monthly income amount
 * @param taxOption - The income tax configuration
 * @param inflationAdjustment - Optional inflation adjustment parameters
 * @returns The monthly tax amount
 */
export function calculateMonthlyIncomeTax(
  monthlyIncome: number,
  taxOption: TaxOption,
  inflationAdjustment?: InflationAdjustment
): number {
  // Annualize the monthly income
  const annualIncome = monthlyIncome * 12

  // Calculate annual tax with inflation adjustment
  const annualTax = calculateTax(annualIncome, taxOption, inflationAdjustment)

  // Return monthly portion
  return annualTax / 12
}
