/**
 * Shared formatting helpers for currency and inflation-adjusted values.
 */

/**
 * Format a number as EUR currency with no fraction digits.
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-EU', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

/**
 * Convert a nominal future value to today's purchasing power.
 *
 * @param value - The nominal value to adjust.
 * @param yearsFromNow - Number of years from the reference (now).
 * @param inflationRate - Annual inflation rate as a percentage (e.g. 2.5).
 * @returns The inflation-adjusted value, or the original value when adjustment is disabled.
 */
export function adjustForInflation(
  value: number,
  yearsFromNow: number,
  inflationRate?: number,
): number {
  if (!inflationRate || inflationRate === 0) return value
  return value / Math.pow(1 + inflationRate / 100, yearsFromNow)
}
