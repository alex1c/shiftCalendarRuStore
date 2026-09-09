/**
 * Default shift templates shipped with Phase 1.
 * Letters Д / Н / В are the primary distinguisher; colors are secondary.
 */

import type { ShiftType } from '@/src/types'

export const SHIFT_TYPE_DAY_ID = 'day'
export const SHIFT_TYPE_NIGHT_ID = 'night'
export const SHIFT_TYPE_OFF_ID = 'off'

export const DEFAULT_SHIFT_TYPES: ShiftType[] = [
	{
		id: SHIFT_TYPE_DAY_ID,
		name: 'Дневная',
		shortName: 'Д',
		kind: 'day',
		startTime: '08:00',
		endTime: '20:00',
		breakMinutes: 0,
		color: 'day',
	},
	{
		id: SHIFT_TYPE_NIGHT_ID,
		name: 'Ночная',
		shortName: 'Н',
		kind: 'night',
		startTime: '20:00',
		endTime: '08:00',
		breakMinutes: 0,
		color: 'night',
	},
	{
		id: SHIFT_TYPE_OFF_ID,
		name: 'Выходной',
		shortName: 'В',
		kind: 'off',
		startTime: null,
		endTime: null,
		breakMinutes: 0,
		color: 'off',
	},
]

const SHIFT_TYPE_BY_ID = new Map(
	DEFAULT_SHIFT_TYPES.map((shift) => [shift.id, shift]),
)

/** Look up a default shift type by id. */
export function getDefaultShiftType (id: string): ShiftType | undefined {
	return SHIFT_TYPE_BY_ID.get(id)
}

/** Require a default shift type — throws if the catalog is incomplete. */
export function requireDefaultShiftType (id: string): ShiftType {
	const shift = getDefaultShiftType(id)
	if (!shift) {
		throw new Error(`Unknown default shift type: ${id}`)
	}
	return shift
}
