/**
 * Month represents a specific month as an integer counting months since January 1900.
 * This provides a simpler, more efficient representation than JavaScript Date objects
 * for month-level precision calculations.
 *
 * Examples:
 * - January 1900 = 0
 * - February 1900 = 1
 * - January 2024 = 1488
 * - November 2025 = 1510
 */
export type Month = number;

/**
 * Convert a Date object to a Month value.
 * @param date The Date object to convert
 * @returns Month value (months since January 1900)
 */
export function dateToMonth(date: Date): Month {
  const year = date.getFullYear();
  const month = date.getMonth(); // 0-11
  return (year - 1900) * 12 + month;
}

/**
 * Convert a Month value to a Date object (first day of that month).
 * @param month The Month value to convert
 * @returns Date object set to the first day of the month
 */
export function monthToDate(month: Month): Date {
  const year = Math.floor(month / 12) + 1900;
  const monthIndex = month % 12;
  return new Date(year, monthIndex, 1);
}

/**
 * Convert an ISO date string (YYYY-MM-DD) to a Month value.
 * @param dateString ISO date string
 * @returns Month value, or undefined if the string is invalid
 */
export function stringToMonth(dateString: string | undefined): Month | undefined {
  if (!dateString) return undefined;

  const date = new Date(dateString);
  if (isNaN(date.getTime())) return undefined;

  return dateToMonth(date);
}

/**
 * Convert a Month value to an ISO date string (YYYY-MM-DD) representing the first day of that month.
 * @param month The Month value to convert
 * @returns ISO date string (YYYY-MM-DD)
 */
export function monthToString(month: Month | undefined): string | undefined {
  if (month === undefined) return undefined;

  const date = monthToDate(month);
  return date.toISOString().split('T')[0];
}

/**
 * Get the current month.
 * @returns Current Month value
 */
export function getCurrentMonth(): Month {
  return dateToMonth(new Date());
}

/**
 * Add months to a Month value.
 * @param month The starting Month value
 * @param monthsToAdd Number of months to add (can be negative)
 * @returns New Month value
 */
export function addMonths(month: Month, monthsToAdd: number): Month {
  return month + monthsToAdd;
}

/**
 * Calculate the difference between two Month values.
 * @param month1 The first Month value
 * @param month2 The second Month value
 * @returns Number of months between them (month1 - month2)
 */
export function monthDiff(month1: Month, month2: Month): number {
  return month1 - month2;
}

/**
 * Get the year of a Month value.
 * @param month The Month value
 * @returns The year (e.g., 2024)
 */
export function getYear(month: Month): number {
  return Math.floor(month / 12) + 1900;
}

/**
 * Get the month index (0-11) of a Month value.
 * @param month The Month value
 * @returns The month index (0 = January, 11 = December)
 */
export function getMonthIndex(month: Month): number {
  return month % 12;
}

/**
 * Get the month name of a Month value.
 * @param month The Month value
 * @param locale Optional locale for month name (defaults to 'en-US')
 * @returns The month name (e.g., "January", "February")
 */
export function getMonthName(month: Month, locale = 'en-US'): string {
  const date = monthToDate(month);
  return date.toLocaleString(locale, { month: 'long' });
}

/**
 * Get the short month name of a Month value.
 * @param month The Month value
 * @param locale Optional locale for month name (defaults to 'en-US')
 * @returns The short month name (e.g., "Jan", "Feb")
 */
export function getMonthNameShort(month: Month, locale = 'en-US'): string {
  const date = monthToDate(month);
  return date.toLocaleString(locale, { month: 'short' });
}

/**
 * Create a Month value from year and month index.
 * @param year The year (e.g., 2024)
 * @param monthIndex The month index (0 = January, 11 = December)
 * @returns Month value
 */
export function fromYearMonth(year: number, monthIndex: number): Month {
  return (year - 1900) * 12 + monthIndex;
}

/**
 * Format a Month value as a string.
 * @param month The Month value
 * @param format Format string: 'YYYY-MM', 'YYYY-MM-DD', 'full' (e.g., "January 2024"), 'short' (e.g., "Jan 2024")
 * @returns Formatted string
 */
export function formatMonth(month: Month | undefined, format: 'YYYY-MM' | 'YYYY-MM-DD' | 'full' | 'short' = 'YYYY-MM'): string {
  if (month === undefined) return '';

  const year = getYear(month);
  const monthIndex = getMonthIndex(month);

  switch (format) {
    case 'YYYY-MM':
      return `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
    case 'YYYY-MM-DD':
      return monthToString(month)!;
    case 'full':
      return `${getMonthName(month)} ${year}`;
    case 'short':
      return `${getMonthNameShort(month)} ${year}`;
    default:
      return `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
  }
}

/**
 * Parse a Month value from a formatted string.
 * Supports formats: 'YYYY-MM', 'YYYY-MM-DD'
 * @param str The formatted string
 * @returns Month value, or undefined if parsing fails
 */
export function parseMonth(str: string | undefined): Month | undefined {
  if (!str) return undefined;

  // Try YYYY-MM or YYYY-MM-DD format
  const match = str.match(/^(\d{4})-(\d{2})(?:-\d{2})?$/);
  if (match && match[1] && match[2]) {
    const year = parseInt(match[1], 10);
    const monthIndex = parseInt(match[2], 10) - 1; // Convert to 0-based
    if (monthIndex >= 0 && monthIndex < 12) {
      return fromYearMonth(year, monthIndex);
    }
  }

  return undefined;
}

/**
 * Validate that a value is a valid Month.
 * @param value The value to validate
 * @returns True if the value is a valid Month
 */
export function isValidMonth(value: unknown): value is Month {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}
