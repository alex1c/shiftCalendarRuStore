/**
 * Custom cycle builder — validation and pure list operations.
 * The calendar engine is unchanged; this module only prepares cycle payloads.
 */

import type { ShiftType, WorkSchedule } from '@/src/types'
import { createId } from '@/src/utils/id'
import { CUSTOM_PRESET_ID } from './presets'
import { DEFAULT_SHIFT_TYPES } from './shift-types'
import { isValidClockTime, shiftDurationMinutes } from './time'

export const MIN_CYCLE_LENGTH = 1
export const MAX_CYCLE_LENGTH = 31
export const MAX_SHIFT_NAME_LENGTH = 40
export const MIN_SHORT_NAME_LENGTH = 1
export const MAX_SHORT_NAME_LENGTH = 3
export const MAX_SCHEDULE_NAME_LENGTH = 40
export const DEFAULT_CUSTOM_SCHEDULE_NAME = 'Мой график'
export const DEFAULT_CUSTOM_SHIFT_COLOR = 'evening'
export const DEFAULT_CUSTOM_START_TIME = '14:00'
export const DEFAULT_CUSTOM_END_TIME = '22:00'

/** Palette tokens a user can pick for a custom shift. */
export const CUSTOM_SHIFT_COLOR_TOKENS = [
	'evening',
	'morning',
	'late',
	'accent',
	'day',
	'night',
] as const

export type CustomShiftColorToken =
	(typeof CUSTOM_SHIFT_COLOR_TOKENS)[number]

export type ValidationResult<T extends object = object> =
	| ({ ok: true } & T)
	| { ok: false; message: string }

export type CustomCycleDraft = {
	name: string
	cycle: string[]
	shiftTypes: ShiftType[]
}

export type CustomShiftInput = {
	name: string
	shortName: string
	startTime: string
	endTime: string
	breakMinutes: number | string
	color: string
}

export type ValidatedCustomShift = {
	name: string
	shortName: string
	startTime: string
	endTime: string
	breakMinutes: number
	color: string
}

export function createEmptyCustomDraft (): CustomCycleDraft {
	return {
		name: DEFAULT_CUSTOM_SCHEDULE_NAME,
		cycle: [],
		shiftTypes: DEFAULT_SHIFT_TYPES.map((shift) => ({ ...shift })),
	}
}

export function isCustomSchedule (
	schedule: Pick<WorkSchedule, 'presetId'>,
): boolean {
	return schedule.presetId === CUSTOM_PRESET_ID
}

export function sanitizeScheduleName (name: string): string {
	const trimmed = name.trim().slice(0, MAX_SCHEDULE_NAME_LENGTH)
	return trimmed.length > 0 ? trimmed : DEFAULT_CUSTOM_SCHEDULE_NAME
}

function parseBreakMinutes (
	value: number | string,
): number | null {
	if (typeof value === 'number') {
		if (!Number.isFinite(value) || value < 0 || !Number.isInteger(value)) {
			return null
		}
		return value
	}
	const trimmed = value.trim()
	if (!/^\d+$/.test(trimmed)) {
		return null
	}
	return Number(trimmed)
}

/**
 * Validate a custom shift form. Does not allocate an id — the caller does.
 */
export function validateCustomShift (
	input: CustomShiftInput,
): ValidationResult<{ value: ValidatedCustomShift }> {
	const name = input.name.trim()
	if (name.length === 0) {
		return { ok: false, message: 'Укажите название смены.' }
	}
	if (name.length > MAX_SHIFT_NAME_LENGTH) {
		return {
			ok: false,
			message: `Название не длиннее ${MAX_SHIFT_NAME_LENGTH} символов.`,
		}
	}

	const shortName = input.shortName.trim()
	if (shortName.length < MIN_SHORT_NAME_LENGTH) {
		return { ok: false, message: 'Укажите короткое обозначение.' }
	}
	if (shortName.length > MAX_SHORT_NAME_LENGTH) {
		return {
			ok: false,
			message: 'Короткое обозначение — от 1 до 3 символов.',
		}
	}

	const startTime = input.startTime.trim()
	const endTime = input.endTime.trim()
	if (!isValidClockTime(startTime) || !isValidClockTime(endTime)) {
		return { ok: false, message: 'Время должно быть в формате ЧЧ:ММ.' }
	}

	const breakMinutes = parseBreakMinutes(input.breakMinutes)
	if (breakMinutes === null) {
		return {
			ok: false,
			message: 'Перерыв — целое число минут, не меньше 0.',
		}
	}

	const duration = shiftDurationMinutes(startTime, endTime)
	if (breakMinutes > duration) {
		return {
			ok: false,
			message: 'Перерыв не может быть дольше самой смены.',
		}
	}

	const color = CUSTOM_SHIFT_COLOR_TOKENS.includes(
		input.color as CustomShiftColorToken,
	)
		? input.color
		: DEFAULT_CUSTOM_SHIFT_COLOR

	return {
		ok: true,
		value: {
			name,
			shortName,
			startTime,
			endTime,
			breakMinutes,
			color,
		},
	}
}

export function createCustomShiftType (
	input: CustomShiftInput,
): ValidationResult<{ shift: ShiftType }> {
	const result = validateCustomShift(input)
	if (!result.ok) {
		return result
	}
	return {
		ok: true,
		shift: {
			id: createId('sft'),
			kind: 'custom',
			...result.value,
		},
	}
}

export function applyCustomShiftEdits (
	existing: ShiftType,
	input: CustomShiftInput,
): ValidationResult<{ shift: ShiftType }> {
	const result = validateCustomShift(input)
	if (!result.ok) {
		return result
	}
	return {
		ok: true,
		shift: {
			...existing,
			kind: 'custom',
			...result.value,
		},
	}
}

export function validateCycleLength (length: number): ValidationResult {
	if (length < MIN_CYCLE_LENGTH) {
		return { ok: false, message: 'Добавьте хотя бы одну смену.' }
	}
	if (length > MAX_CYCLE_LENGTH) {
		return {
			ok: false,
			message: `Цикл не может быть длиннее ${MAX_CYCLE_LENGTH} дней.`,
		}
	}
	return { ok: true }
}

export function canAppendCycleItem (cycleLength: number): ValidationResult {
	if (cycleLength >= MAX_CYCLE_LENGTH) {
		return {
			ok: false,
			message: `Цикл не может быть длиннее ${MAX_CYCLE_LENGTH} дней.`,
		}
	}
	return { ok: true }
}

export function appendCycleItem (
	cycle: readonly string[],
	shiftTypeId: string,
): ValidationResult<{ cycle: string[] }> {
	const limit = canAppendCycleItem(cycle.length)
	if (!limit.ok) {
		return limit
	}
	return { ok: true, cycle: [...cycle, shiftTypeId] }
}

export function removeCycleItem (
	cycle: readonly string[],
	index: number,
): string[] {
	return cycle.filter((_, itemIndex) => itemIndex !== index)
}

export function moveCycleItem (
	cycle: readonly string[],
	index: number,
	direction: -1 | 1,
): string[] {
	const target = index + direction
	if (index < 0 || index >= cycle.length || target < 0 || target >= cycle.length) {
		return [...cycle]
	}
	const next = [...cycle]
	const [item] = next.splice(index, 1)
	next.splice(target, 0, item)
	return next
}

export function duplicateCycleItem (
	cycle: readonly string[],
	index: number,
): ValidationResult<{ cycle: string[] }> {
	const shiftTypeId = cycle[index]
	if (shiftTypeId == null) {
		return { ok: false, message: 'Не удалось скопировать смену.' }
	}
	return appendCycleItem(cycle, shiftTypeId)
}

export function replaceCycleItem (
	cycle: readonly string[],
	index: number,
	shiftTypeId: string,
): string[] {
	if (index < 0 || index >= cycle.length) {
		return [...cycle]
	}
	const next = [...cycle]
	next[index] = shiftTypeId
	return next
}

/**
 * Keep catalog entries that the cycle actually references.
 * Unused custom types are dropped; order follows first appearance in cycle.
 */
export function collectUsedShiftTypes (
	cycle: readonly string[],
	catalog: readonly ShiftType[],
): ShiftType[] {
	const byId = new Map(catalog.map((shift) => [shift.id, shift]))
	const used: ShiftType[] = []
	const seen = new Set<string>()
	for (const shiftId of cycle) {
		if (seen.has(shiftId)) {
			continue
		}
		const shift = byId.get(shiftId)
		if (!shift) {
			throw new Error(`Unknown shift type id in cycle: ${shiftId}`)
		}
		seen.add(shiftId)
		used.push({ ...shift })
	}
	return used
}

export function upsertShiftType (
	catalog: readonly ShiftType[],
	shift: ShiftType,
): ShiftType[] {
	const index = catalog.findIndex((item) => item.id === shift.id)
	if (index === -1) {
		return [...catalog, shift]
	}
	const next = [...catalog]
	next[index] = { ...shift }
	return next
}

export function findShiftType (
	catalog: readonly ShiftType[],
	shiftTypeId: string,
): ShiftType | undefined {
	return catalog.find((item) => item.id === shiftTypeId)
}

/**
 * A cycle is persistable only when it has 1–31 items and every id resolves.
 */
export function validateCycleForSave (
	cycle: readonly string[],
	catalog: readonly ShiftType[],
): ValidationResult {
	const lengthCheck = validateCycleLength(cycle.length)
	if (!lengthCheck.ok) {
		return lengthCheck
	}
	const known = new Set(catalog.map((shift) => shift.id))
	for (const shiftId of cycle) {
		if (!known.has(shiftId)) {
			return {
				ok: false,
				message: 'В цикле есть неизвестный тип смены.',
			}
		}
	}
	return { ok: true }
}
