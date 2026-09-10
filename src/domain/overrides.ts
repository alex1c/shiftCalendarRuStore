/**
 * Day overrides — exceptions on top of the repeating cycle.
 * The cycle engine stays untouched; this module only composes
 * `base shift + optional override` into an effective day.
 */

import {
	DAY_OVERRIDE_TYPES,
	type DayOverride,
	type DayOverrideMap,
	type DayOverrideType,
	type ShiftType,
	type WorkSchedule,
} from '@/src/types'
import { createId } from '@/src/utils/id'
import { resolveShiftForDate } from './cycle'
import type { ValidationResult } from './custom'
import {
	MAX_SHIFT_NAME_LENGTH,
	MAX_SHORT_NAME_LENGTH,
	MIN_SHORT_NAME_LENGTH,
} from './custom'
import { isWorkShift, workDurationMinutes } from './duration'
import {
	SHIFT_TYPE_DAY_ID,
	SHIFT_TYPE_NIGHT_ID,
	SHIFT_TYPE_OFF_ID,
	requireDefaultShiftType,
} from './shift-types'
import { isValidClockTime } from './time'

export const MAX_OVERRIDE_NOTE_LENGTH = 500
export const MAX_OVERTIME_MINUTES = 24 * 60

export type EffectiveDay = {
	date: string
	baseShift: ShiftType
	override: DayOverride | null
	/** Display / duration shift after applying the override. */
	shift: ShiftType
	isOverridden: boolean
}

export type OverrideEditorKind =
	| 'base'
	| 'day'
	| 'night'
	| 'off'
	| 'vacation'
	| 'sick'
	| 'dayOff'
	| 'extraShift'
	| 'overtime'
	| 'custom'

export type DayOverrideInput = {
	date: string
	type: DayOverrideType
	shiftTypeId?: string | null
	startTime?: string | null
	endTime?: string | null
	breakMinutes?: number | string
	overtimeMinutes?: number | string
	customName?: string | null
	customShortName?: string | null
	isWork?: boolean | null
	note?: string | null
}

const NON_WORK_TYPES: ReadonlySet<DayOverrideType> = new Set([
	'off',
	'vacation',
	'sick',
	'dayOff',
])

const TYPE_SET: ReadonlySet<string> = new Set(DAY_OVERRIDE_TYPES)

/** Russian labels for override types (details / editor). */
export const OVERRIDE_TYPE_LABELS: Record<DayOverrideType, string> = {
	work: 'Рабочая смена',
	off: 'Выходной',
	vacation: 'Отпуск',
	sick: 'Больничный',
	dayOff: 'Отгул',
	extraShift: 'Доп. смена',
	overtime: 'Переработка',
	custom: 'Другое',
}

export function emptyOverrideMap (): DayOverrideMap {
	return {}
}

export function getOverrideForDate (
	overrides: DayOverrideMap,
	date: string,
): DayOverride | null {
	return overrides[date] ?? null
}

export function upsertOverride (
	overrides: DayOverrideMap,
	override: DayOverride,
): DayOverrideMap {
	return {
		...overrides,
		[override.date]: override,
	}
}

export function removeOverrideAtDate (
	overrides: DayOverrideMap,
	date: string,
): DayOverrideMap {
	if (overrides[date] == null) {
		return overrides
	}
	const next = { ...overrides }
	delete next[date]
	return next
}

export function isDayOverrideType (value: string): value is DayOverrideType {
	return TYPE_SET.has(value)
}

/** True when this override turns the day into a non-working exception. */
export function isNonWorkingOverrideType (type: DayOverrideType): boolean {
	return NON_WORK_TYPES.has(type)
}

/** Whether the override itself counts as a work day for stats / next-shift. */
export function overrideCountsAsWork (override: DayOverride): boolean {
	if (isNonWorkingOverrideType(override.type)) {
		return false
	}
	if (override.type === 'overtime') {
		return override.overtimeMinutes > 0
	}
	if (override.type === 'custom') {
		return override.isWork === true
	}
	return true
}

function parseNonNegativeInt (value: number | string | undefined): number | null {
	if (value == null || value === '') {
		return 0
	}
	if (typeof value === 'number') {
		if (!Number.isFinite(value) || value < 0 || !Number.isInteger(value)) {
			return null
		}
		return value
	}
	const trimmed = value.trim()
	if (trimmed.length === 0) {
		return 0
	}
	if (!/^\d+$/.test(trimmed)) {
		return null
	}
	return Number(trimmed)
}

function lookupShiftType (
	schedule: WorkSchedule,
	shiftTypeId: string,
): ShiftType | undefined {
	return (
		schedule.shiftTypes.find((item) => item.id === shiftTypeId) ??
		undefined
	)
}

function requireShiftTemplate (
	schedule: WorkSchedule,
	shiftTypeId: string,
): ShiftType {
	return lookupShiftType(schedule, shiftTypeId) ?? requireDefaultShiftType(shiftTypeId)
}

/**
 * Build the ShiftType shown on the calendar / details for an override.
 * Clock times come from the override when present, otherwise from the template.
 */
export function shiftFromOverride (
	schedule: WorkSchedule,
	baseShift: ShiftType,
	override: DayOverride,
): ShiftType {
	if (override.type === 'off') {
		const off = requireDefaultShiftType(SHIFT_TYPE_OFF_ID)
		return { ...off, id: `override-off-${override.date}` }
	}
	if (override.type === 'vacation') {
		return {
			id: `override-vacation-${override.date}`,
			name: OVERRIDE_TYPE_LABELS.vacation,
			shortName: 'ОТП',
			kind: 'off',
			startTime: null,
			endTime: null,
			breakMinutes: 0,
			color: 'vacation',
		}
	}
	if (override.type === 'sick') {
		return {
			id: `override-sick-${override.date}`,
			name: OVERRIDE_TYPE_LABELS.sick,
			shortName: 'Б',
			kind: 'off',
			startTime: null,
			endTime: null,
			breakMinutes: 0,
			color: 'sick',
		}
	}
	if (override.type === 'dayOff') {
		return {
			id: `override-dayoff-${override.date}`,
			name: OVERRIDE_TYPE_LABELS.dayOff,
			shortName: 'ОТГ',
			kind: 'off',
			startTime: null,
			endTime: null,
			breakMinutes: 0,
			color: 'dayOff',
		}
	}
	if (override.type === 'extraShift') {
		const template = override.shiftTypeId
			? requireShiftTemplate(schedule, override.shiftTypeId)
			: requireDefaultShiftType(SHIFT_TYPE_DAY_ID)
		return {
			id: `override-extra-${override.date}`,
			name: OVERRIDE_TYPE_LABELS.extraShift,
			shortName: 'ДС',
			kind: 'custom',
			startTime: override.startTime ?? template.startTime,
			endTime: override.endTime ?? template.endTime,
			breakMinutes: override.breakMinutes,
			color: 'extra',
		}
	}
	if (override.type === 'overtime') {
		return {
			id: `override-overtime-${override.date}`,
			name: OVERRIDE_TYPE_LABELS.overtime,
			shortName: 'ПР',
			kind: 'custom',
			startTime: baseShift.startTime,
			endTime: baseShift.endTime,
			breakMinutes: baseShift.breakMinutes,
			color: 'overtime',
		}
	}
	if (override.type === 'custom') {
		const working = override.isWork === true
		return {
			id: `override-custom-${override.date}`,
			name: override.customName ?? OVERRIDE_TYPE_LABELS.custom,
			shortName: override.customShortName ?? 'ДР',
			kind: working ? 'custom' : 'off',
			startTime: working ? override.startTime : null,
			endTime: working ? override.endTime : null,
			breakMinutes: working ? override.breakMinutes : 0,
			color: working ? 'accent' : 'custom',
		}
	}
	const templateId = override.shiftTypeId ?? SHIFT_TYPE_DAY_ID
	const template = requireShiftTemplate(schedule, templateId)
	return {
		...template,
		id: `override-work-${override.date}`,
		startTime: override.startTime ?? template.startTime,
		endTime: override.endTime ?? template.endTime,
		breakMinutes: override.breakMinutes,
	}
}

/**
 * Base cycle shift plus an optional one-day override.
 * Does not mutate the cycle, startDate, or other dates.
 */
export function getEffectiveDay (
	schedule: WorkSchedule,
	date: string,
	overrides: DayOverrideMap = {},
): EffectiveDay {
	const baseShift = resolveShiftForDate(schedule, date)
	const override = getOverrideForDate(overrides, date)
	if (!override) {
		return {
			date,
			baseShift,
			override: null,
			shift: baseShift,
			isOverridden: false,
		}
	}
	return {
		date,
		baseShift,
		override,
		shift: shiftFromOverride(schedule, baseShift, override),
		isOverridden: true,
	}
}

/** Worked minutes for stats / details, including overtime extras. */
export function effectiveWorkMinutes (day: EffectiveDay): number {
	if (!day.isOverridden || !day.override) {
		return workDurationMinutes(day.shift)
	}
	const override = day.override
	if (!overrideCountsAsWork(override)) {
		return 0
	}
	if (override.type === 'overtime') {
		return workDurationMinutes(day.baseShift) + override.overtimeMinutes
	}
	return workDurationMinutes(day.shift)
}

export function isEffectiveWorkDay (day: EffectiveDay): boolean {
	if (!day.isOverridden || !day.override) {
		return isWorkShift(day.shift)
	}
	return overrideCountsAsWork(day.override)
}

export function overridesHaveWork (overrides: DayOverrideMap): boolean {
	return Object.values(overrides).some(overrideCountsAsWork)
}

export function validateDayOverride (
	input: DayOverrideInput,
): ValidationResult<{ value: DayOverrideInput }> {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
		return { ok: false, message: 'Некорректная дата.' }
	}

	const note = input.note?.trim() ?? ''
	if (note.length > MAX_OVERRIDE_NOTE_LENGTH) {
		return {
			ok: false,
			message: `Заметка не длиннее ${MAX_OVERRIDE_NOTE_LENGTH} символов.`,
		}
	}

	if (isNonWorkingOverrideType(input.type)) {
		return { ok: true, value: input }
	}

	if (input.type === 'overtime') {
		const minutes = parseNonNegativeInt(input.overtimeMinutes)
		if (minutes == null || minutes <= 0) {
			return { ok: false, message: 'Укажите длительность переработки.' }
		}
		if (minutes > MAX_OVERTIME_MINUTES) {
			return { ok: false, message: 'Переработка не больше 24 часов.' }
		}
		return { ok: true, value: input }
	}

	if (input.type === 'custom') {
		const name = (input.customName ?? '').trim()
		if (name.length === 0) {
			return { ok: false, message: 'Укажите название.' }
		}
		if (name.length > MAX_SHIFT_NAME_LENGTH) {
			return {
				ok: false,
				message: `Название не длиннее ${MAX_SHIFT_NAME_LENGTH} символов.`,
			}
		}
		const shortName = (input.customShortName ?? '').trim()
		if (shortName.length < MIN_SHORT_NAME_LENGTH) {
			return { ok: false, message: 'Укажите короткое обозначение.' }
		}
		if (shortName.length > MAX_SHORT_NAME_LENGTH) {
			return {
				ok: false,
				message: `Короткое обозначение — ${MIN_SHORT_NAME_LENGTH}–${MAX_SHORT_NAME_LENGTH} символа.`,
			}
		}
		if (input.isWork === true) {
			const times = validateWorkTimes(input)
			if (!times.ok) {
				return times
			}
		}
		return { ok: true, value: input }
	}

	return validateWorkTimes(input)
}

function validateWorkTimes (
	input: DayOverrideInput,
): ValidationResult<{ value: DayOverrideInput }> {
	const start = input.startTime?.trim() ?? ''
	const end = input.endTime?.trim() ?? ''
	if (!isValidClockTime(start) || !isValidClockTime(end)) {
		return { ok: false, message: 'Укажите время начала и окончания.' }
	}
	const breakMinutes = parseNonNegativeInt(input.breakMinutes)
	if (breakMinutes == null) {
		return { ok: false, message: 'Перерыв — целое число минут.' }
	}
	return { ok: true, value: input }
}

/**
 * Create or update a persisted override. Caller must validate first.
 */
export function buildDayOverride (
	input: DayOverrideInput,
	existing: DayOverride | null,
	now: Date = new Date(),
): DayOverride {
	const iso = now.toISOString()
	const note = input.note?.trim() ? input.note.trim() : null
	const breakMinutes = parseNonNegativeInt(input.breakMinutes) ?? 0
	const overtimeMinutes = parseNonNegativeInt(input.overtimeMinutes) ?? 0
	const workTimes = !isNonWorkingOverrideType(input.type) &&
		input.type !== 'overtime' &&
		(input.type !== 'custom' || input.isWork === true)

	return {
		id: existing?.id ?? createId('ovr'),
		date: input.date,
		type: input.type,
		shiftTypeId: input.shiftTypeId ?? null,
		startTime: workTimes ? (input.startTime ?? null) : null,
		endTime: workTimes ? (input.endTime ?? null) : null,
		breakMinutes: workTimes ? breakMinutes : 0,
		overtimeMinutes: input.type === 'overtime' ? overtimeMinutes : 0,
		customName:
			input.type === 'custom' ? (input.customName?.trim() ?? null) : null,
		customShortName:
			input.type === 'custom'
				? (input.customShortName?.trim() ?? null)
				: null,
		isWork: input.type === 'custom' ? Boolean(input.isWork) : null,
		note,
		createdAt: existing?.createdAt ?? iso,
		updatedAt: iso,
	}
}

export function editorKindFromOverride (
	override: DayOverride | null,
): OverrideEditorKind {
	if (!override) {
		return 'base'
	}
	if (override.type === 'work') {
		return override.shiftTypeId === SHIFT_TYPE_NIGHT_ID ? 'night' : 'day'
	}
	return override.type
}

export function defaultTimesForEditorKind (
	kind: OverrideEditorKind,
): { startTime: string; endTime: string } {
	if (kind === 'night') {
		const night = requireDefaultShiftType(SHIFT_TYPE_NIGHT_ID)
		return {
			startTime: night.startTime ?? '20:00',
			endTime: night.endTime ?? '08:00',
		}
	}
	const day = requireDefaultShiftType(SHIFT_TYPE_DAY_ID)
	return {
		startTime: day.startTime ?? '08:00',
		endTime: day.endTime ?? '20:00',
	}
}

export function shiftTypeIdForEditorKind (
	kind: OverrideEditorKind,
): string | null {
	if (kind === 'day') {
		return SHIFT_TYPE_DAY_ID
	}
	if (kind === 'night') {
		return SHIFT_TYPE_NIGHT_ID
	}
	if (kind === 'extraShift') {
		return SHIFT_TYPE_DAY_ID
	}
	return null
}

export function overrideTypeForEditorKind (
	kind: Exclude<OverrideEditorKind, 'base' | 'day' | 'night'>,
): DayOverrideType {
	return kind
}

export function isDayOverride (value: unknown): value is DayOverride {
	if (!value || typeof value !== 'object') {
		return false
	}
	const record = value as Partial<DayOverride>
	return (
		typeof record.id === 'string' &&
		typeof record.date === 'string' &&
		typeof record.type === 'string' &&
		isDayOverrideType(record.type) &&
		typeof record.createdAt === 'string' &&
		typeof record.updatedAt === 'string'
	)
}
