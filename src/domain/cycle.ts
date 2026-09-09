/**
 * Cycle engine — resolve the shift on any civil date from start + cycle.
 *
 * Uses day-difference + modulo. Does not walk day-by-day from startDate.
 * Dates before startDate are supported via positive modulo.
 */

import type { ShiftType, WorkSchedule } from '@/src/types'
import { calendarDaysBetween, positiveModulo } from './dates'

/**
 * Index into `cycle` for `targetDate`, wrapping in both directions.
 */
export function getCycleIndex (
	startDate: string,
	cycleLength: number,
	targetDate: string,
): number {
	if (cycleLength <= 0) {
		throw new Error('Cycle must contain at least one day')
	}
	return positiveModulo(
		calendarDaysBetween(startDate, targetDate),
		cycleLength,
	)
}

/**
 * Resolve the shift type that falls on `targetDate` for a saved schedule.
 */
export function resolveShiftForDate (
	schedule: WorkSchedule,
	targetDate: string,
): ShiftType {
	const index = getCycleIndex(
		schedule.startDate,
		schedule.cycle.length,
		targetDate,
	)
	const shiftId = schedule.cycle[index]
	const shift = schedule.shiftTypes.find((item) => item.id === shiftId)
	if (!shift) {
		throw new Error(`Unknown shift type id in cycle: ${shiftId}`)
	}
	return shift
}

/**
 * Same resolution from raw parts — used by tests and onboarding previews.
 */
export function resolveShiftFromCycle (
	startDate: string,
	cycle: readonly string[],
	shiftTypes: readonly ShiftType[],
	targetDate: string,
): ShiftType {
	const index = getCycleIndex(startDate, cycle.length, targetDate)
	const shiftId = cycle[index]
	const shift = shiftTypes.find((item) => item.id === shiftId)
	if (!shift) {
		throw new Error(`Unknown shift type id in cycle: ${shiftId}`)
	}
	return shift
}
