/**
 * Russian date / cycle formatting. Kept in domain so UI does not invent copy.
 */

import type { SchedulePreset, ShiftType } from '@/src/types'
import { mondayFirstWeekday, parseCalendarDate } from './dates'
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

const WEEKDAY_NAMES_MONDAY_FIRST = [
	'понедельник',
	'вторник',
	'среда',
	'четверг',
	'пятница',
	'суббота',
	'воскресенье',
] as const

/**
 * Russian plural: 1 смена, 2 смены, 5 смен.
 */
export function ruPlural (
	count: number,
	one: string,
	few: string,
	many: string,
): string {
	const abs = Math.abs(count) % 100
	const last = abs % 10
	if (abs > 10 && abs < 20) {
		return many
	}
	if (last === 1) {
		return one
	}
	if (last >= 2 && last <= 4) {
		return few
	}
	return many
}

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

/** `Вторник, 9 сентября` */
export function formatWeekdayDayMonth (iso: string): string {
	const name = WEEKDAY_NAMES_MONDAY_FIRST[mondayFirstWeekday(iso)]
	const capitalized = `${name.charAt(0).toUpperCase()}${name.slice(1)}`
	return `${capitalized}, ${formatDayMonth(iso)}`
}

/**
 * Details-card title. Built-in day/night get «смена»; off and custom keep name.
 */
export function formatShiftTitle (shift: ShiftType): string {
	if (shift.kind === 'day' || shift.kind === 'night') {
		return `${shift.name} смена`
	}
	return shift.name
}

/** Compact today line: `Сегодня — Ночная` / `Сегодня — выходной`. */
export function formatTodaySummary (shift: ShiftType): string {
	if (shift.kind === 'off') {
		return 'Сегодня — выходной'
	}
	return `Сегодня — ${shift.name}`
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
