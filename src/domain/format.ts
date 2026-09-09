/**
 * Russian date / cycle formatting. Kept in domain so UI does not invent copy.
 */

import type { SchedulePreset, ShiftType } from '@/src/types'
import { parseCalendarDate } from './dates'
import { requireDefaultShiftType } from './shift-types'

const MONTHS_NOMINATIVE = [
	'январь',
	'февраль',
	'март',
	'апрель',
	'май',
	'июнь',
	'июль',
	'август',
	'сентябрь',
	'октябрь',
	'ноябрь',
	'декабрь',
] as const

const MONTHS_GENITIVE = [
	'января',
	'февраля',
	'марта',
	'апреля',
	'мая',
	'июня',
	'июля',
	'августа',
	'сентября',
	'октября',
	'ноября',
	'декабря',
] as const

export const WEEKDAY_LABELS_MONDAY_FIRST = [
	'Пн',
	'Вт',
	'Ср',
	'Чт',
	'Пт',
	'Сб',
	'Вс',
] as const

function shortNameFor (
	shiftId: string,
	shiftTypes: readonly ShiftType[],
): string {
	const found = shiftTypes.find((item) => item.id === shiftId)
	if (found) {
		return found.shortName
	}
	return requireDefaultShiftType(shiftId).shortName
}

/** Visual cycle as `Д  Д  В  В`. */
export function formatCycleLetters (
	cycle: readonly string[],
	shiftTypes: readonly ShiftType[],
	separator = '  ',
): string {
	return cycle
		.map((id) => shortNameFor(id, shiftTypes))
		.join(separator)
}

/** Confirmation cycle as `Д → Д → В → В`. */
export function formatCycleArrows (
	cycle: readonly string[],
	shiftTypes: readonly ShiftType[],
): string {
	return cycle
		.map((id) => shortNameFor(id, shiftTypes))
		.join(' → ')
}

/** Compact hyphen form used in hints: `Д-Д-В-В`. */
export function formatCycleHyphen (
	cycle: readonly string[],
	shiftTypes: readonly ShiftType[],
): string {
	return formatCycleLetters(cycle, shiftTypes, '-')
}

/** `9 сентября`. */
export function formatDayMonth (iso: string): string {
	const { month, day } = parseCalendarDate(iso)
	return `${day} ${MONTHS_GENITIVE[month - 1]}`
}

/** `9 сентября 2026`. */
export function formatDayMonthYear (iso: string): string {
	const { year, month, day } = parseCalendarDate(iso)
	return `${day} ${MONTHS_GENITIVE[month - 1]} ${year}`
}

/** `Сентябрь 2026`. */
export function formatMonthYear (year: number, month: number): string {
	const name = MONTHS_NOMINATIVE[month - 1]
	if (!name) {
		throw new Error(`Invalid month: ${month}`)
	}
	return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${year}`
}

/** `08:00–20:00`, or null when the shift has no clock times. */
export function formatShiftHours (shift: ShiftType): string | null {
	if (!shift.startTime || !shift.endTime) {
		return null
	}
	return `${shift.startTime}–${shift.endTime}`
}

/**
 * Extra hint under the start-date picker, tied to the selected preset.
 */
export function getStartDateHint (
	preset: SchedulePreset,
	shiftTypes: readonly ShiftType[],
): string {
	const letters = formatCycleHyphen(preset.cycle, shiftTypes)
	if (preset.id === '2-2') {
		return `Для графика ${letters} укажите первый день первой дневной смены.`
	}
	if (preset.id === 'day-night-48') {
		return `Для графика ${letters} укажите первый день дневной смены.`
	}
	const first = shiftTypes.find((item) => item.id === preset.cycle[0])
	const firstName = first?.name ?? 'первого элемента'
	return `Для графика ${letters} укажите день, который соответствует «${firstName}».`
}

/**
 * Start-date hint for an arbitrary cycle (presets and custom drafts).
 */
export function getStartDateHintFromCycle (
	cycle: readonly string[],
	shiftTypes: readonly ShiftType[],
): string {
	if (cycle.length === 0) {
		return 'Выберите день, который соответствует первому элементу выбранного цикла.'
	}
	const letters = formatCycleHyphen(cycle, shiftTypes)
	const first = shiftTypes.find((item) => item.id === cycle[0])
	const firstName = first?.name ?? 'первого элемента'
	return `Для графика ${letters} укажите день, который соответствует «${firstName}».`
}
