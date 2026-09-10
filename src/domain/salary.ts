/**
 * Estimated earnings calculator over effective days.
 *
 * This is a user-facing shift calculator, not employer payroll. Vacation,
 * sick leave, taxes, holidays and regional coefficients are out of scope.
 *
 * Pay uses the same civil-date walk as statistics: cycle + overrides.
 * Money is always integer kopecks.
 *
 * Overtime double-count rule:
 * `effectiveWorkMinutes` already includes overtime extras. Salary splits
 * regular minutes (base shift duration) from `overtimeMinutes` and never
 * pays both the combined total and a second full overtime pass.
 *
 * Night bonus rule (Phase 7):
 * applied only when the paid shift kind is `night` (cycle night, or the
 * base shift under an overtime override). Custom / extra-shift kinds do
 * not get an automatic night bonus. Overtime minutes are not night-bonused.
 */

import type { DayOverrideMap, WorkSchedule } from '@/src/types'
import { addCalendarDays, calendarDaysBetween } from './dates'
import {
	applyBps,
	applyMultiplier,
	DEFAULT_EXTRA_SHIFT_MULTIPLIER_HUNDREDTHS,
	DEFAULT_NIGHT_BONUS_BPS,
	DEFAULT_OVERTIME_MULTIPLIER_HUNDREDTHS,
	formatRublesFromMinor,
	payForMinutes,
} from './money'
import { isWorkShift, workDurationMinutes } from './duration'
import {
	getEffectiveDay,
	isEffectiveWorkDay,
	type EffectiveDay,
} from './overrides'
import { clampCivilRange } from './stats'

export const SALARY_SCHEMA_VERSION = 1

export type SalaryMode = 'hourly' | 'shift'

export type SalarySettings = {
	enabled: boolean
	mode: SalaryMode
	hourlyRateMinor: number
	shiftRateMinor: number
	nightBonusEnabled: boolean
	/** 2000 = 20%. */
	nightBonusBps: number
	overtimeEnabled: boolean
	/** 150 = 1.5×. */
	overtimeMultiplierHundredths: number
	/** Shift-mode overtime hourly rate; 0 means hours are shown but unpaid. */
	overtimeHourlyRateMinor: number
	/** 100 = 1×. Extra shifts always use this coefficient. */
	extraShiftMultiplierHundredths: number
	createdAt: string
	updatedAt: string
}

export type SalaryTotals = {
	regularPayMinor: number
	nightBonusMinor: number
	overtimePayMinor: number
	extraShiftPayMinor: number
	totalPayMinor: number
	regularMinutes: number
	nightMinutes: number
	nightShifts: number
	overtimeMinutes: number
	extraShiftMinutes: number
	extraShifts: number
	regularShifts: number
}

type DayPaySlice = {
	regularMinutes: number
	regularShifts: number
	nightMinutes: number
	nightShifts: number
	overtimeMinutes: number
	extraMinutes: number
	extraShifts: number
}

export function emptySalaryTotals (): SalaryTotals {
	return {
		regularPayMinor: 0,
		nightBonusMinor: 0,
		overtimePayMinor: 0,
		extraShiftPayMinor: 0,
		totalPayMinor: 0,
		regularMinutes: 0,
		nightMinutes: 0,
		nightShifts: 0,
		overtimeMinutes: 0,
		extraShiftMinutes: 0,
		extraShifts: 0,
		regularShifts: 0,
	}
}

export function defaultSalarySettings (
	now: Date = new Date(),
): SalarySettings {
	const stamp = now.toISOString()
	return {
		enabled: false,
		mode: 'hourly',
		hourlyRateMinor: 0,
		shiftRateMinor: 0,
		nightBonusEnabled: false,
		nightBonusBps: DEFAULT_NIGHT_BONUS_BPS,
		overtimeEnabled: false,
		overtimeMultiplierHundredths: DEFAULT_OVERTIME_MULTIPLIER_HUNDREDTHS,
		overtimeHourlyRateMinor: 0,
		extraShiftMultiplierHundredths:
			DEFAULT_EXTRA_SHIFT_MULTIPLIER_HUNDREDTHS,
		createdAt: stamp,
		updatedAt: stamp,
	}
}

export function isSalaryMode (value: unknown): value is SalaryMode {
	return value === 'hourly' || value === 'shift'
}

function isNonNegativeInt (value: unknown): value is number {
	return typeof value === 'number' && Number.isInteger(value) && value >= 0
}

/** True when stored settings look structurally valid. */
export function isSalarySettings (value: unknown): value is SalarySettings {
	if (!value || typeof value !== 'object') {
		return false
	}
	const record = value as Partial<SalarySettings>
	return (
		typeof record.enabled === 'boolean' &&
		isSalaryMode(record.mode) &&
		isNonNegativeInt(record.hourlyRateMinor) &&
		isNonNegativeInt(record.shiftRateMinor) &&
		typeof record.nightBonusEnabled === 'boolean' &&
		isNonNegativeInt(record.nightBonusBps) &&
		typeof record.overtimeEnabled === 'boolean' &&
		isNonNegativeInt(record.overtimeMultiplierHundredths) &&
		isNonNegativeInt(record.overtimeHourlyRateMinor) &&
		isNonNegativeInt(record.extraShiftMultiplierHundredths) &&
		typeof record.createdAt === 'string' &&
		typeof record.updatedAt === 'string'
	)
}

/**
 * Feature is on only when the user opted in and entered a rate for the
 * active mode. Disabled / empty settings must not show `0 ₽` as earnings.
 */
export function isSalaryEnabled (
	settings: SalarySettings | null,
): settings is SalarySettings {
	if (!settings || !settings.enabled) {
		return false
	}
	if (settings.mode === 'hourly') {
		return settings.hourlyRateMinor > 0
	}
	return settings.shiftRateMinor > 0
}

function emptySlice (): DayPaySlice {
	return {
		regularMinutes: 0,
		regularShifts: 0,
		nightMinutes: 0,
		nightShifts: 0,
		overtimeMinutes: 0,
		extraMinutes: 0,
		extraShifts: 0,
	}
}

/**
 * Night kind for pay: overtime uses the cycle/base shift, never the
 * synthetic overtime overlay (which is kind `custom`). Extra shifts are
 * not auto-classified as night even if they reuse a night template.
 */
function isNightPayShift (day: EffectiveDay): boolean {
	const type = day.override?.type
	if (type === 'extraShift' || type === 'custom') {
		return false
	}
	if (type === 'overtime') {
		return day.baseShift.kind === 'night'
	}
	return day.shift.kind === 'night'
}

/**
 * Split one effective day into unpaid / regular / extra / overtime slices.
 * Vacation, sick and day-off overrides are unpaid here on purpose.
 */
export function salarySliceForDay (day: EffectiveDay): DayPaySlice {
	const slice = emptySlice()
	const type = day.override?.type
	if (
		type === 'vacation' ||
		type === 'sick' ||
		type === 'dayOff' ||
		type === 'off'
	) {
		return slice
	}

	if (type === 'extraShift' && isEffectiveWorkDay(day)) {
		slice.extraMinutes = workDurationMinutes(day.shift)
		slice.extraShifts = 1
		return slice
	}

	if (type === 'overtime') {
		const overtimeMinutes = day.override?.overtimeMinutes ?? 0
		const baseIsWork = isWorkShift(day.baseShift)
		const regularMinutes = baseIsWork
			? workDurationMinutes(day.baseShift)
			: 0
		slice.overtimeMinutes = overtimeMinutes
		slice.regularMinutes = regularMinutes
		if (baseIsWork) {
			slice.regularShifts = 1
			if (isNightPayShift(day)) {
				slice.nightMinutes = regularMinutes
				slice.nightShifts = 1
			}
		}
		return slice
	}

	if (!isEffectiveWorkDay(day)) {
		return slice
	}

	const regularMinutes = workDurationMinutes(day.shift)
	slice.regularMinutes = regularMinutes
	slice.regularShifts = 1
	if (isNightPayShift(day)) {
		slice.nightMinutes = regularMinutes
		slice.nightShifts = 1
	}
	return slice
}

function payOvertime (
	settings: SalarySettings,
	overtimeMinutes: number,
): number {
	if (!settings.overtimeEnabled || overtimeMinutes <= 0) {
		return 0
	}
	const rateMinor =
		settings.mode === 'hourly'
			? settings.hourlyRateMinor
			: settings.overtimeHourlyRateMinor
	if (rateMinor <= 0) {
		return 0
	}
	return applyMultiplier(
		payForMinutes(overtimeMinutes, rateMinor),
		settings.overtimeMultiplierHundredths,
	)
}

function payNightBonus (
	settings: SalarySettings,
	nightBasePayMinor: number,
): number {
	if (!settings.nightBonusEnabled || nightBasePayMinor <= 0) {
		return 0
	}
	return applyBps(nightBasePayMinor, settings.nightBonusBps)
}

/**
 * Aggregate estimated pay from `startDate` through `endDate` inclusive.
 * UI must not recompute money — only format these integer totals.
 */
export function computeSalaryForPeriod (
	schedule: WorkSchedule,
	overrides: DayOverrideMap,
	settings: SalarySettings,
	startDate: string,
	endDate: string,
): SalaryTotals {
	const totals = emptySalaryTotals()
	const range = clampCivilRange(startDate, endDate)
	if (!range || !isSalaryEnabled(settings)) {
		return totals
	}

	const lastIndex = calendarDaysBetween(range.startDate, range.endDate)
	for (let offset = 0; offset <= lastIndex; offset += 1) {
		const date = addCalendarDays(range.startDate, offset)
		const day = getEffectiveDay(schedule, date, overrides)
		const slice = salarySliceForDay(day)
		totals.regularMinutes += slice.regularMinutes
		totals.regularShifts += slice.regularShifts
		totals.nightMinutes += slice.nightMinutes
		totals.nightShifts += slice.nightShifts
		totals.overtimeMinutes += slice.overtimeMinutes
		totals.extraShiftMinutes += slice.extraMinutes
		totals.extraShifts += slice.extraShifts
	}

	if (settings.mode === 'hourly') {
		totals.regularPayMinor = payForMinutes(
			totals.regularMinutes,
			settings.hourlyRateMinor,
		)
		totals.nightBonusMinor = payNightBonus(
			settings,
			payForMinutes(totals.nightMinutes, settings.hourlyRateMinor),
		)
		totals.extraShiftPayMinor = applyMultiplier(
			payForMinutes(
				totals.extraShiftMinutes,
				settings.hourlyRateMinor,
			),
			settings.extraShiftMultiplierHundredths,
		)
	} else {
		totals.regularPayMinor =
			totals.regularShifts * settings.shiftRateMinor
		totals.nightBonusMinor = payNightBonus(
			settings,
			totals.nightShifts * settings.shiftRateMinor,
		)
		totals.extraShiftPayMinor = applyMultiplier(
			totals.extraShifts * settings.shiftRateMinor,
			settings.extraShiftMultiplierHundredths,
		)
	}

	totals.overtimePayMinor = payOvertime(settings, totals.overtimeMinutes)
	totals.totalPayMinor =
		totals.regularPayMinor +
		totals.nightBonusMinor +
		totals.overtimePayMinor +
		totals.extraShiftPayMinor
	return totals
}

const PREVIEW_SHIFT_MINUTES = 12 * 60

/** Short settings preview for a 12-hour sample shift. */
export function formatSalaryPreview (settings: SalarySettings): string[] {
	const lines: string[] = []
	if (settings.mode === 'hourly' && settings.hourlyRateMinor > 0) {
		const base = payForMinutes(
			PREVIEW_SHIFT_MINUTES,
			settings.hourlyRateMinor,
		)
		lines.push(
			`При ставке ${formatRublesFromMinor(settings.hourlyRateMinor)}/ч ` +
				`смена 12 ч ≈ ${formatRublesFromMinor(base)}`,
		)
		if (settings.nightBonusEnabled && settings.nightBonusBps > 0) {
			const night = base + applyBps(base, settings.nightBonusBps)
			lines.push(`Ночная 12 ч ≈ ${formatRublesFromMinor(night)}`)
		}
		return lines
	}
	if (settings.mode === 'shift' && settings.shiftRateMinor > 0) {
		lines.push(
			`Смена ≈ ${formatRublesFromMinor(settings.shiftRateMinor)}`,
		)
		if (settings.nightBonusEnabled && settings.nightBonusBps > 0) {
			const night =
				settings.shiftRateMinor +
				applyBps(settings.shiftRateMinor, settings.nightBonusBps)
			lines.push(`Ночная смена ≈ ${formatRublesFromMinor(night)}`)
		}
	}
	return lines
}
