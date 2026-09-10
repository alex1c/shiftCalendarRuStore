/**
 * Calendar insights derived from the existing cycle engine
 * plus optional one-day overrides. Does not pre-generate years of dates.
 */

import type { DayOverrideMap, ShiftType, WorkSchedule } from '@/src/types'
import { addCalendarDays, calendarDaysBetween, daysInMonth, formatCalendarDate } from './dates'
import { formatDurationMinutes, isWorkShift } from './duration'
import { formatDayMonth, ruPlural } from './format'
import {
	effectiveWorkMinutes,
	getEffectiveDay,
	isEffectiveWorkDay,
	overridesHaveWork,
} from './overrides'

export const NEXT_SHIFT_SEARCH_DAYS = 366

export type NextWorkShift =
	| { found: true; date: string; shift: ShiftType }
	| { found: false }

export type MonthStats = {
	workShifts: number
	offDays: number
	workMinutes: number
}

/** True when the repeating cycle contains at least one work day. */
export function cycleHasWorkShift (schedule: WorkSchedule): boolean {
	return schedule.cycle.some((shiftId) => {
		const shift = schedule.shiftTypes.find((item) => item.id === shiftId)
		return shift != null && isWorkShift(shift)
	})
}

/**
 * First work day strictly after `fromDate`, honoring overrides.
 * Bound: 366 days. All-off cycles with no work overrides return immediately.
 */
export function findNextWorkShift (
	schedule: WorkSchedule,
	fromDate: string,
	overrides: DayOverrideMap = {},
): NextWorkShift {
	if (!cycleHasWorkShift(schedule) && !overridesHaveWork(overrides)) {
		return { found: false }
	}
	for (let offset = 1; offset <= NEXT_SHIFT_SEARCH_DAYS; offset += 1) {
		const date = addCalendarDays(fromDate, offset)
		const day = getEffectiveDay(schedule, date, overrides)
		if (isEffectiveWorkDay(day)) {
			return { found: true, date, shift: day.shift }
		}
	}
	return { found: false }
}

/**
 * Stats for civil days that belong to `year`/`month` (1–12).
 * Adjacent-month grid padding is ignored. Overrides replace the cycle.
 */
export function computeMonthStats (
	schedule: WorkSchedule,
	year: number,
	month: number,
	overrides: DayOverrideMap = {},
): MonthStats {
	const days = daysInMonth(year, month)
	let workShifts = 0
	let offDays = 0
	let workMinutes = 0
	for (let day = 1; day <= days; day += 1) {
		const date = formatCalendarDate(year, month, day)
		const effective = getEffectiveDay(schedule, date, overrides)
		if (isEffectiveWorkDay(effective)) {
			workShifts += 1
			workMinutes += effectiveWorkMinutes(effective)
		} else {
			offDays += 1
		}
	}
	return { workShifts, offDays, workMinutes }
}

/** `15 смен • 180 ч • 15 выходных` */
export function formatMonthStats (stats: MonthStats): string {
	const shifts = ruPlural(stats.workShifts, 'смена', 'смены', 'смен')
	const offs = ruPlural(stats.offDays, 'выходной', 'выходных', 'выходных')
	return `${stats.workShifts} ${shifts} • ${formatDurationMinutes(stats.workMinutes)} • ${stats.offDays} ${offs}`
}

const NO_WORK_SHIFTS = 'Рабочих смен в текущем цикле нет'

/**
 * `Следующая смена: завтра, 08:00` or `Следующая смена: 12 сентября, 20:00`.
 */
export function formatNextWorkShift (
	fromDate: string,
	next: NextWorkShift,
): string {
	if (!next.found) {
		return NO_WORK_SHIFTS
	}
	const timeSuffix = next.shift.startTime ? `, ${next.shift.startTime}` : ''
	const delta = calendarDaysBetween(fromDate, next.date)
	if (delta === 1) {
		return `Следующая смена: завтра${timeSuffix}`
	}
	return `Следующая смена: ${formatDayMonth(next.date)}${timeSuffix}`
}
