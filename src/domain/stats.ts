/**
 * Period statistics over effective days (cycle + overrides).
 * Iteration is civil-date only — no timezone-dependent datetime stepping.
 */

import type { DayOverrideMap, WorkSchedule } from '@/src/types'
import {
	addCalendarDays,
	calendarDaysBetween,
	daysInMonth,
	formatCalendarDate,
	parseCalendarDate,
	todayCalendarDate,
} from './dates'
import { formatDurationMinutes } from './duration'
import { formatDayMonth, formatDayMonthYear, ruPlural } from './format'
import {
	effectiveWorkMinutes,
	getEffectiveDay,
	isEffectiveWorkDay,
	type EffectiveDay,
} from './overrides'

export const MAX_STATS_SPAN_DAYS = 3660

export type StatsPeriodKind = '7' | '30' | '90' | 'month' | 'year' | 'all'

export type CivilRange = {
	startDate: string
	endDate: string
}

export type PeriodStats = {
	dayCount: number
	workShifts: number
	workMinutes: number
	dayShifts: number
	nightShifts: number
	otherWorkShifts: number
	offDays: number
	vacationDays: number
	sickDays: number
	dayOffDays: number
	extraShifts: number
	overtimeMinutes: number
}

export const STATS_PERIOD_OPTIONS: {
	kind: StatsPeriodKind
	label: string
}[] = [
	{ kind: '7', label: '7 дней' },
	{ kind: '30', label: '30 дней' },
	{ kind: '90', label: '90 дней' },
	{ kind: 'month', label: 'Месяц' },
	{ kind: 'year', label: 'Год' },
	{ kind: 'all', label: 'Всё' },
]

export function emptyPeriodStats (): PeriodStats {
	return {
		dayCount: 0,
		workShifts: 0,
		workMinutes: 0,
		dayShifts: 0,
		nightShifts: 0,
		otherWorkShifts: 0,
		offDays: 0,
		vacationDays: 0,
		sickDays: 0,
		dayOffDays: 0,
		extraShifts: 0,
		overtimeMinutes: 0,
	}
}

/**
 * Inclusive civil range for a period selector.
 * Rolling 7/30/90 end today; month/year are the current calendar period
 * (and may include future planned days). `all` is startDate → today.
 */
export function resolveStatsPeriod (
	kind: StatsPeriodKind,
	scheduleStartDate: string,
	now: Date = new Date(),
): CivilRange {
	const today = todayCalendarDate(now)
	const { year, month } = parseCalendarDate(today)

	if (kind === '7' || kind === '30' || kind === '90') {
		const length = Number(kind)
		return {
			startDate: addCalendarDays(today, -(length - 1)),
			endDate: today,
		}
	}
	if (kind === 'month') {
		return {
			startDate: formatCalendarDate(year, month, 1),
			endDate: formatCalendarDate(year, month, daysInMonth(year, month)),
		}
	}
	if (kind === 'year') {
		return {
			startDate: formatCalendarDate(year, 1, 1),
			endDate: formatCalendarDate(year, 12, 31),
		}
	}
	return {
		startDate: scheduleStartDate,
		endDate: today,
	}
}

/**
 * Inclusive civil range with the same span cap as period stats.
 * Empty when start is after end; over-long ranges keep the last N days.
 */
export function clampCivilRange (
	startDate: string,
	endDate: string,
): CivilRange | null {
	const span = calendarDaysBetween(startDate, endDate)
	if (span < 0) {
		return null
	}
	if (span + 1 > MAX_STATS_SPAN_DAYS) {
		return {
			startDate: addCalendarDays(endDate, -(MAX_STATS_SPAN_DAYS - 1)),
			endDate,
		}
	}
	return { startDate, endDate }
}

function workBucket (day: EffectiveDay): 'day' | 'night' | 'other' {
	const kind =
		day.override?.type === 'overtime' ? day.baseShift.kind : day.shift.kind
	if (kind === 'day') {
		return 'day'
	}
	if (kind === 'night') {
		return 'night'
	}
	return 'other'
}

/**
 * Aggregate effective days from `startDate` through `endDate` inclusive.
 */
export function computePeriodStats (
	schedule: WorkSchedule,
	overrides: DayOverrideMap,
	startDate: string,
	endDate: string,
): PeriodStats {
	const range = clampCivilRange(startDate, endDate)
	if (!range) {
		return emptyPeriodStats()
	}
	const stats = emptyPeriodStats()
	const lastIndex = calendarDaysBetween(range.startDate, range.endDate)
	for (let offset = 0; offset <= lastIndex; offset += 1) {
		const date = addCalendarDays(range.startDate, offset)
		const day = getEffectiveDay(schedule, date, overrides)
		stats.dayCount += 1
		const type = day.override?.type
		if (type === 'vacation') {
			stats.vacationDays += 1
			continue
		}
		if (type === 'sick') {
			stats.sickDays += 1
			continue
		}
		if (type === 'dayOff') {
			stats.dayOffDays += 1
			continue
		}
		if (isEffectiveWorkDay(day)) {
			stats.workShifts += 1
			stats.workMinutes += effectiveWorkMinutes(day)
			if (type === 'extraShift') {
				stats.extraShifts += 1
			}
			if (type === 'overtime') {
				stats.overtimeMinutes += day.override?.overtimeMinutes ?? 0
			}
			const bucket = workBucket(day)
			if (bucket === 'day') {
				stats.dayShifts += 1
			} else if (bucket === 'night') {
				stats.nightShifts += 1
			} else {
				stats.otherWorkShifts += 1
			}
			continue
		}
		stats.offDays += 1
	}
	return stats
}

/** `1 день` / `2 дня` / `5 дней`. */
export function formatDayCount (count: number): string {
	return `${count} ${ruPlural(count, 'день', 'дня', 'дней')}`
}

/** Inclusive Russian range, never ISO. */
export function formatCivilRange (startDate: string, endDate: string): string {
	if (startDate === endDate) {
		return formatDayMonthYear(startDate)
	}
	const start = parseCalendarDate(startDate)
	const end = parseCalendarDate(endDate)
	if (start.year === end.year && start.month === end.month) {
		return `${start.day}–${formatDayMonthYear(endDate)}`
	}
	if (start.year === end.year) {
		return `${formatDayMonth(startDate)} — ${formatDayMonth(endDate)}`
	}
	return `${formatDayMonthYear(startDate)} — ${formatDayMonthYear(endDate)}`
}

export function formatStatsPeriodLabel (
	kind: StatsPeriodKind,
	range: CivilRange,
): string {
	if (kind === 'year') {
		return `${parseCalendarDate(range.startDate).year} год`
	}
	return formatCivilRange(range.startDate, range.endDate)
}

export function formatWorkHours (minutes: number): string {
	return formatDurationMinutes(minutes)
}
