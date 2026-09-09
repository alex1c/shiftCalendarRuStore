/**
 * Calendar-date helpers that never depend on local timezone offsets or DST.
 *
 * All schedule math uses civil dates (`YYYY-MM-DD`). Instant timestamps are
 * converted through local Y/M/D getters, then compared via UTC midnight so
 * a day is always 86 400 000 ms in the calculation space.
 */

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/
const MS_PER_DAY = 86_400_000

export type CivilDate = {
	year: number
	month: number
	day: number
}

function pad2 (value: number): string {
	return String(value).padStart(2, '0')
}

/**
 * Format a civil date as `YYYY-MM-DD`.
 * `month` is 1–12.
 */
export function formatCalendarDate (
	year: number,
	month: number,
	day: number,
): string {
	return `${year}-${pad2(month)}-${pad2(day)}`
}

/**
 * Parse and validate a calendar ISO date. Invalid civil dates throw
 * (e.g. 2025-02-29) instead of rolling over into March.
 */
export function parseCalendarDate (iso: string): CivilDate {
	const match = ISO_DATE.exec(iso)
	if (!match) {
		throw new Error(`Invalid calendar date: ${iso}`)
	}
	const year = Number(match[1])
	const month = Number(match[2])
	const day = Number(match[3])
	const utc = Date.UTC(year, month - 1, day)
	const check = new Date(utc)
	if (
		check.getUTCFullYear() !== year ||
		check.getUTCMonth() !== month - 1 ||
		check.getUTCDate() !== day
	) {
		throw new Error(`Invalid calendar date: ${iso}`)
	}
	return { year, month, day }
}

/**
 * Convert a JS Date to the user's local calendar day.
 * Time of day is ignored on purpose so 00:00 and 23:59 stay the same day.
 */
export function calendarDateFromDate (date: Date): string {
	return formatCalendarDate(
		date.getFullYear(),
		date.getMonth() + 1,
		date.getDate(),
	)
}

/** Today's civil date in the device local timezone. */
export function todayCalendarDate (now: Date = new Date()): string {
	return calendarDateFromDate(now)
}

/**
 * Local Date at noon for a civil date. Noon avoids DST edges when a native
 * picker needs a Date object; schedule math still uses ISO strings.
 */
export function calendarDateToLocalDate (iso: string): Date {
	const { year, month, day } = parseCalendarDate(iso)
	return new Date(year, month - 1, day, 12, 0, 0, 0)
}

/** UTC epoch for the civil midnight of an ISO date. */
function utcMidnightMs (iso: string): number {
	const { year, month, day } = parseCalendarDate(iso)
	return Date.UTC(year, month - 1, day)
}

/**
 * Signed day difference: `target - start`.
 * Negative when `target` is before `start`.
 */
export function calendarDaysBetween (
	startDate: string,
	targetDate: string,
): number {
	const delta = utcMidnightMs(targetDate) - utcMidnightMs(startDate)
	return Math.round(delta / MS_PER_DAY)
}

/**
 * Add (or subtract) whole calendar days. Uses UTC civil arithmetic so
 * month/year/leap boundaries stay correct.
 */
export function addCalendarDays (iso: string, days: number): string {
	const utc = utcMidnightMs(iso) + days * MS_PER_DAY
	const date = new Date(utc)
	return formatCalendarDate(
		date.getUTCFullYear(),
		date.getUTCMonth() + 1,
		date.getUTCDate(),
	)
}

/**
 * Always-positive remainder. Required so dates before `startDate`
 * continue the cycle backward instead of producing negative indexes.
 */
export function positiveModulo (value: number, modulo: number): number {
	if (modulo <= 0 || !Number.isInteger(modulo)) {
		throw new Error(`Modulo must be a positive integer, got ${modulo}`)
	}
	return ((value % modulo) + modulo) % modulo
}

/** Number of days in a civil month (1–12). Leap years included. */
export function daysInMonth (year: number, month: number): number {
	return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

/**
 * Shift a year/month pair by `delta` months. `month` is 1–12.
 */
export function addMonths (
	year: number,
	month: number,
	delta: number,
): { year: number; month: number } {
	const index = year * 12 + (month - 1) + delta
	return {
		year: Math.floor(index / 12),
		month: (index % 12 + 12) % 12 + 1,
	}
}

/**
 * Monday-first weekday index for a civil date.
 * 0 = Monday … 6 = Sunday.
 */
export function mondayFirstWeekday (iso: string): number {
	const { year, month, day } = parseCalendarDate(iso)
	const sundayFirst = new Date(Date.UTC(year, month - 1, day)).getUTCDay()
	return (sundayFirst + 6) % 7
}
