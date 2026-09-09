/**
 * Domain model for work schedules.
 * Types are schedule-agnostic: 2/2 is only one possible cycle, not the schema.
 */

/**
 * Semantic kind of a shift. `custom` is reserved for user-defined types
 * in later phases; Phase 1 ships day / night / off.
 */
export type ShiftKind = 'day' | 'night' | 'off' | 'custom'

/**
 * One shift template used inside a repeating cycle.
 * `color` is a palette token (`day` / `night` / `off`) resolved by the theme,
 * not the only way to tell shifts apart — `shortName` is always shown.
 */
export type ShiftType = {
	id: string
	name: string
	shortName: string
	kind: ShiftKind
	/** Local clock time `HH:mm`, or null when the day is off. */
	startTime: string | null
	/** Local clock time `HH:mm`, or null when the day is off. */
	endTime: string | null
	breakMinutes: number
	color: string
}

/**
 * Built-in repeating cycle the user can pick during onboarding.
 * `cycle` stores shift type ids in display order.
 */
export type SchedulePreset = {
	id: string
	name: string
	description: string
	cycle: string[]
}

/**
 * Persisted work schedule. The calendar never stores thousands of dates;
 * each day is derived from `startDate` + `cycle` at read time.
 */
export type WorkSchedule = {
	id: string
	name: string
	/** Preset id, or `custom` when a builder exists (Phase 2). */
	presetId: string
	/** Inclusive cycle origin as a calendar date `YYYY-MM-DD`. */
	startDate: string
	/** Repeating sequence of shift type ids. */
	cycle: string[]
	shiftTypes: ShiftType[]
	createdAt: string
	updatedAt: string
}
