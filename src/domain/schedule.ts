/**
 * Work-schedule factory — UI must not assemble cycle payloads itself.
 */

import type { SchedulePreset, ShiftType, WorkSchedule } from '@/src/types'
import { createId } from '@/src/utils/id'
import {
	collectUsedShiftTypes,
	sanitizeScheduleName,
	validateCycleForSave,
} from './custom'
import { CUSTOM_PRESET_ID } from './presets'
import { DEFAULT_SHIFT_TYPES } from './shift-types'

type CreateScheduleInput = {
	preset: SchedulePreset
	startDate: string
	shiftTypes?: ShiftType[]
	now?: Date
}

type CreateCustomScheduleInput = {
	name: string
	startDate: string
	cycle: readonly string[]
	shiftTypes: readonly ShiftType[]
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

/**
 * Build a persistable schedule from a user-built custom cycle.
 * Rejects empty / oversized cycles so invalid drafts never reach storage.
 */
export function createWorkScheduleFromCustom ({
	name,
	startDate,
	cycle,
	shiftTypes,
	now = new Date(),
}: CreateCustomScheduleInput): WorkSchedule {
	const validation = validateCycleForSave(cycle, shiftTypes)
	if (!validation.ok) {
		throw new Error(validation.message)
	}
	const timestamp = now.toISOString()
	return {
		id: createId('sch'),
		name: sanitizeScheduleName(name),
		presetId: CUSTOM_PRESET_ID,
		startDate,
		cycle: [...cycle],
		shiftTypes: collectUsedShiftTypes(cycle, shiftTypes),
		createdAt: timestamp,
		updatedAt: timestamp,
	}
}

/** Structural guard for a persisted work schedule document. */
export function isWorkSchedule (value: unknown): value is WorkSchedule {
	if (!value || typeof value !== 'object') {
		return false
	}
	const record = value as Partial<WorkSchedule>
	return (
		typeof record.id === 'string' &&
		typeof record.name === 'string' &&
		typeof record.presetId === 'string' &&
		typeof record.startDate === 'string' &&
		Array.isArray(record.cycle) &&
		record.cycle.length > 0 &&
		Array.isArray(record.shiftTypes) &&
		record.shiftTypes.length > 0
	)
}
