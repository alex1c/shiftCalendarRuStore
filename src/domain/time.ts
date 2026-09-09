/**
 * Clock-time helpers for custom shifts.
 * Times are civil `HH:mm` strings; overnight ranges are allowed.
 */

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/
const MINUTES_PER_DAY = 24 * 60

export type ClockTime = {
	hours: number
	minutes: number
}

/**
 * Parse a strict `HH:mm` clock time. Returns null when the string is invalid.
 */
export function parseClockTime (value: string): ClockTime | null {
	const match = TIME_PATTERN.exec(value.trim())
	if (!match) {
		return null
	}
	return {
		hours: Number(match[1]),
		minutes: Number(match[2]),
	}
}

export function isValidClockTime (value: string): boolean {
	return parseClockTime(value) !== null
}

/** Minutes from local midnight. */
export function clockTimeToMinutes (value: string): number {
	const parsed = parseClockTime(value)
	if (!parsed) {
		throw new Error(`Invalid clock time: ${value}`)
	}
	return parsed.hours * 60 + parsed.minutes
}

/**
 * Shift duration in minutes. Overnight (`20:00–08:00`) wraps past midnight.
 * Equal start and end is treated as a 24-hour shift.
 */
export function shiftDurationMinutes (
	startTime: string,
	endTime: string,
): number {
	const start = clockTimeToMinutes(startTime)
	const end = clockTimeToMinutes(endTime)
	if (end === start) {
		return MINUTES_PER_DAY
	}
	if (end > start) {
		return end - start
	}
	return MINUTES_PER_DAY - start + end
}

/** Format hours/minutes from a Date as `HH:mm`. */
export function formatClockTimeFromDate (date: Date): string {
	const hours = String(date.getHours()).padStart(2, '0')
	const minutes = String(date.getMinutes()).padStart(2, '0')
	return `${hours}:${minutes}`
}

/** Local Date at the given clock time, for native time pickers. */
export function clockTimeToDate (
	value: string,
	now: Date = new Date(),
): Date {
	const parsed = parseClockTime(value) ?? { hours: 8, minutes: 0 }
	return new Date(
		now.getFullYear(),
		now.getMonth(),
		now.getDate(),
		parsed.hours,
		parsed.minutes,
		0,
		0,
	)
}
