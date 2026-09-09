/**
 * Work-schedule factory — UI must not assemble cycle payloads itself.
 */

import type { SchedulePreset, ShiftType, WorkSchedule } from '@/src/types'
import { createId } from '@/src/utils/id'
import { DEFAULT_SHIFT_TYPES } from './shift-types'

type CreateScheduleInput = {
	preset: SchedulePreset
	startDate: string
	shiftTypes?: ShiftType[]
	now?: Date
}

/**
 * Build a persistable schedule from a built-in preset and a cycle start date.
 */
export function createWorkScheduleFromPreset ({
	preset,
	startDate,
	shiftTypes = DEFAULT_SHIFT_TYPES,
	now = new Date(),
}: CreateScheduleInput): WorkSchedule {
	const timestamp = now.toISOString()
	return {
		id: createId('sch'),
		name: preset.name,
		presetId: preset.id,
		startDate,
		cycle: [...preset.cycle],
		shiftTypes: shiftTypes.map((shift) => ({ ...shift })),
		createdAt: timestamp,
		updatedAt: timestamp,
	}
}
