/**
 * Helpers that map a timeline scrubber offset to a calendar year and a row
 * position in the annual chart/table. Pure and side-effect free so they can
 * be unit tested without mocking the clock.
 */

import type { Month, DateSpecification } from '@/types/month'
import { addMonths, getYear, getMonthIndex, resolveDate } from '@/types/month'

/**
 * The calendar year that contains the month reached by moving `monthOffset`
 * months forward from `projectionStart`.
 */
export function resolveSelectedYear(projectionStart: Month, monthOffset: number): number {
  return getYear(addMonths(projectionStart, monthOffset))
}

/**
 * The fractional position (0 = January, ~0.92 = December) of the selected
 * month within its calendar year. Used to slide the chart cursor smoothly
 * across a year band while scrubbing month by month.
 */
export function resolveYearFraction(projectionStart: Month, monthOffset: number): number {
  return getMonthIndex(addMonths(projectionStart, monthOffset)) / 12
}

/**
 * Index of the annual summary whose year contains the selected month, or
 * null when no summary matches (e.g. offset beyond the projection).
 */
export function resolveYearIndex(
  projectionStart: Month,
  monthOffset: number,
  years: number[],
): number | null {
  const selectedYear = resolveSelectedYear(projectionStart, monthOffset)
  const index = years.indexOf(selectedYear)
  return index >= 0 ? index : null
}

/**
 * Per-life-event NAV read-out for the timeline.
 */
export interface LifeEventNav {
  eventId: string
  name: string
  month: Month // Resolved absolute month of the event
  monthOffset: number // Months from projectionStart (may be negative or out of range)
  age: number // User's age at the event month
  nav: number | null // Net worth at the event month, null when outside the projection
}

/**
 * Resolve every life event to its month offset and the net worth (NAV) at that
 * point in the projection. Events with no resolvable date are skipped.
 *
 * Pure: takes the resolved inputs and returns data, no clock access.
 */
export function resolveLifeEventNavs(
  projectionStart: Month,
  birthDate: Month,
  lifeEvents: { id: string; name: string; date: DateSpecification | undefined }[],
  monthlyBalances: { balance: number }[],
): LifeEventNav[] {
  const result: LifeEventNav[] = []

  for (const event of lifeEvents) {
    if (!event.date) continue
    const month = resolveDate(event.date, birthDate, lifeEvents)
    if (month === undefined) continue

    const monthOffset = month - projectionStart
    const age = Math.floor((month - birthDate) / 12)
    const inRange = monthOffset >= 0 && monthOffset < monthlyBalances.length
    const nav = inRange ? monthlyBalances[monthOffset]!.balance : null

    result.push({
      eventId: event.id,
      name: event.name,
      month,
      monthOffset,
      age,
      nav,
    })
  }

  // Earliest event first.
  result.sort((a, b) => a.monthOffset - b.monthOffset)
  return result
}
