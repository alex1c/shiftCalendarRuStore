/**
 * Work-time duration helpers.
 * Gross clock span lives in `time.ts`; this module subtracts breaks
 * and treats days off as zero work minutes.
 */

import type { ShiftType } from '@/src/types'
import { shiftDurationMinutes } from './time'

/** A work day is anything that is not an explicit day off. */
export function isWorkShift (shift: ShiftType): boolean {
	return shift.kind !== 'off'
}

/**
 * Paid/worked minutes for a shift: clock span minus break.
 * Off days and shifts without clock times are 0.
 */
export function workDurationMinutes (shift: ShiftType): number {
	if (!isWorkShift(shift) || !shift.startTime || !shift.endTime) {
		return 0
	}
	const span = shiftDurationMinutes(shift.startTime, shift.endTime)
	return Math.max(0, span - shift.breakMinutes)
}

/**
 * Compact Russian duration: `12 ч`, `7 ч 30 мин`, `30 мин`, `0 ч`.
 * Never emits decimals.
 */
export function formatDurationMinutes (totalMinutes: number): string {
	const safe = Math.max(0, Math.round(totalMinutes))
	if (safe === 0) {
		return '0 ч'
	}
	const hours = Math.floor(safe / 60)
	const minutes = safe % 60
	if (hours === 0) {
		return `${minutes} мин`
	}
	if (minutes === 0) {
		return `${hours} ч`
	}
	return `${hours} ч ${minutes} мин`
}
