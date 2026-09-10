/**
 * One-day exceptions layered on top of the repeating cycle.
 * The cycle itself is never rewritten — an override only replaces
 * the effective state for a single `YYYY-MM-DD`.
 */

export const DAY_OVERRIDE_TYPES = [
	'work',
	'off',
	'vacation',
	'sick',
	'dayOff',
	'extraShift',
	'overtime',
	'custom',
] as const

export type DayOverrideType = (typeof DAY_OVERRIDE_TYPES)[number]

/**
 * Persisted exception for a single civil date.
 * Optional clock fields apply to work / extra / custom work days.
 * `overtimeMinutes` is extra work on top of the base shift (Variant B).
 */
export type DayOverride = {
	id: string
	date: string
	type: DayOverrideType
	shiftTypeId: string | null
	startTime: string | null
	endTime: string | null
	breakMinutes: number
	overtimeMinutes: number
	customName: string | null
	customShortName: string | null
	/** Only meaningful for `custom`; null for every other type. */
	isWork: boolean | null
	note: string | null
	createdAt: string
	updatedAt: string
}

/** Fast lookup: at most one override per civil date. */
export type DayOverrideMap = Record<string, DayOverride>
