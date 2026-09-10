/**
 * Today-tab overview: live shift state on top of the effective-day layer.
 * Clock math uses the device local timezone; civil dates stay YYYY-MM-DD.
 */

import type { DayOverrideMap, WorkSchedule } from '@/src/types'
import { addCalendarDays, calendarDaysBetween, todayCalendarDate } from './dates'
import { formatDurationMinutes } from './duration'
import { formatDayMonth, formatShiftHours, formatShiftTitle } from './format'
import {
	findNextWorkShift,
	formatNextWorkShift,
	type NextWorkShift,
} from './insights'
import {
	effectiveWorkMinutes,
	getEffectiveDay,
	isEffectiveWorkDay,
	type EffectiveDay,
} from './overrides'
import { clockTimeToMinutes, localDateTimeFromCalendarClock } from './time'

export type ShiftTimeStateKind =
	| 'beforeShift'
	| 'inShift'
	| 'afterShift'
	| 'nonWorking'

export type ShiftTimeWindow = {
	start: Date
	end: Date
	spansMidnight: boolean
}

export type CurrentShiftState = {
	kind: ShiftTimeStateKind
	/** Day whose clock window is live (yesterday when an overnight shift continues). */
	displayDay: EffectiveDay
	remainingMinutes: number | null
}

export type TodayOverview = {
	todayDate: string
	tomorrowDate: string
	today: EffectiveDay
	tomorrow: EffectiveDay
	activeDay: EffectiveDay
	timeState: ShiftTimeStateKind
	headline: string
	hoursLine: string | null
	statusLine: string | null
	completedMeta: string | null
	durationLine: string | null
	breakLine: string | null
	overtimeLine: string | null
	note: string | null
	next: NextWorkShift
	nextWhen: string | null
	nextTitle: string | null
	nextEmptyMessage: string | null
	tomorrowLine: string
}

const MS_PER_MINUTE = 60_000

/**
 * Local start/end for a shift that belongs to `date`.
 * Overnight ranges (`20:00–08:00`) end on the next civil day.
 */
export function getShiftTimeWindow (
	date: string,
	startTime: string,
	endTime: string,
): ShiftTimeWindow {
	const start = localDateTimeFromCalendarClock(date, startTime)
	const spansMidnight =
		clockTimeToMinutes(endTime) <= clockTimeToMinutes(startTime)
	const endDate = spansMidnight ? addCalendarDays(date, 1) : date
	const end = localDateTimeFromCalendarClock(endDate, endTime)
	return { start, end, spansMidnight }
}

function remainingMinutesUntil (target: Date, now: Date): number {
	const delta = target.getTime() - now.getTime()
	if (delta <= 0) {
		return 0
	}
	return Math.max(1, Math.ceil(delta / MS_PER_MINUTE))
}

function windowForDay (day: EffectiveDay): ShiftTimeWindow | null {
	if (!isEffectiveWorkDay(day) || !day.shift.startTime || !day.shift.endTime) {
		return null
	}
	return getShiftTimeWindow(day.date, day.shift.startTime, day.shift.endTime)
}

/**
 * Live state relative to `now`.
 * An overnight shift that started yesterday still counts as `inShift`.
 */
export function getCurrentShiftState (
	schedule: WorkSchedule,
	overrides: DayOverrideMap,
	now: Date = new Date(),
): CurrentShiftState {
	const todayDate = todayCalendarDate(now)
	const yesterdayDate = addCalendarDays(todayDate, -1)
	const today = getEffectiveDay(schedule, todayDate, overrides)
	const yesterday = getEffectiveDay(schedule, yesterdayDate, overrides)

	const yesterdayWindow = windowForDay(yesterday)
	if (
		yesterdayWindow &&
		now.getTime() >= yesterdayWindow.start.getTime() &&
		now.getTime() < yesterdayWindow.end.getTime()
	) {
		return {
			kind: 'inShift',
			displayDay: yesterday,
			remainingMinutes: remainingMinutesUntil(yesterdayWindow.end, now),
		}
	}

	const todayWindow = windowForDay(today)
	if (!todayWindow) {
		return {
			kind: 'nonWorking',
			displayDay: today,
			remainingMinutes: null,
		}
	}

	if (now.getTime() < todayWindow.start.getTime()) {
		return {
			kind: 'beforeShift',
			displayDay: today,
			remainingMinutes: remainingMinutesUntil(todayWindow.start, now),
		}
	}
	if (now.getTime() < todayWindow.end.getTime()) {
		return {
			kind: 'inShift',
			displayDay: today,
			remainingMinutes: remainingMinutesUntil(todayWindow.end, now),
		}
	}
	return {
		kind: 'afterShift',
		displayDay: today,
		remainingMinutes: null,
	}
}

/**
 * `До начала: 45 мин` / `До конца: 1 ч 05 мин`.
 * Minutes under 10 are zero-padded when hours are also shown.
 */
export function formatCountdown (
	totalMinutes: number,
	phase: 'start' | 'end',
): string {
	const prefix = phase === 'start' ? 'До начала' : 'До конца'
	const safe = Math.max(0, Math.round(totalMinutes))
	if (safe === 0) {
		return `${prefix}: 0 мин`
	}
	const hours = Math.floor(safe / 60)
	const minutes = safe % 60
	if (hours === 0) {
		return `${prefix}: ${minutes} мин`
	}
	if (minutes === 0) {
		return `${prefix}: ${hours} ч`
	}
	return `${prefix}: ${hours} ч ${String(minutes).padStart(2, '0')} мин`
}

function restHeadline (day: EffectiveDay): string {
	const type = day.override?.type
	if (type === 'vacation') {
		return 'Сегодня — отпуск'
	}
	if (type === 'sick') {
		return 'Сегодня — больничный'
	}
	if (type === 'dayOff') {
		return 'Сегодня — отгул'
	}
	if (type === 'extraShift') {
		return 'Сегодня — дополнительная смена'
	}
	if (day.shift.kind === 'off' && day.shift.color === 'off') {
		return 'Сегодня — выходной'
	}
	return `Сегодня — ${day.shift.name}`
}

function workingPhrase (day: EffectiveDay): string {
	if (day.override?.type === 'extraShift') {
		return 'дополнительная смена'
	}
	if (day.override?.type === 'overtime') {
		return formatShiftTitle(day.baseShift)
	}
	return formatShiftTitle(day.shift)
}

function buildHeadline (
	kind: ShiftTimeStateKind,
	displayDay: EffectiveDay,
): string {
	if (kind === 'nonWorking') {
		return restHeadline(displayDay)
	}
	if (kind === 'afterShift') {
		return 'Сегодня смена завершена'
	}
	const phrase = workingPhrase(displayDay)
	if (kind === 'inShift') {
		return `Сейчас — ${phrase}`
	}
	return `Сегодня — ${phrase}`
}

function formatTomorrowLine (day: EffectiveDay): string {
	const hours = formatShiftHours(day.shift)
	if (!isEffectiveWorkDay(day) || !hours) {
		if (day.shift.kind === 'off' && day.shift.color === 'off') {
			return 'Выходной'
		}
		return day.shift.name
	}
	return `${day.shift.name} • ${hours}`
}

function formatNextWhen (
	fromDate: string,
	next: NextWorkShift,
): string | null {
	if (!next.found) {
		return null
	}
	const timeSuffix = next.shift.startTime ? `, ${next.shift.startTime}` : ''
	const delta = calendarDaysBetween(fromDate, next.date)
	if (delta === 1) {
		return `Завтра${timeSuffix}`
	}
	return `${formatDayMonth(next.date)}${timeSuffix}`
}

/**
 * Ready-to-render Today model. UI must not recompute shift windows.
 */
export function getTodayOverview (
	schedule: WorkSchedule,
	overrides: DayOverrideMap,
	now: Date = new Date(),
): TodayOverview {
	const todayDate = todayCalendarDate(now)
	const tomorrowDate = addCalendarDays(todayDate, 1)
	const today = getEffectiveDay(schedule, todayDate, overrides)
	const tomorrow = getEffectiveDay(schedule, tomorrowDate, overrides)
	const current = getCurrentShiftState(schedule, overrides, now)
	const hoursLine = formatShiftHours(current.displayDay.shift)
	const showWorkMeta =
		(current.kind === 'beforeShift' || current.kind === 'inShift') &&
		isEffectiveWorkDay(current.displayDay)

	let statusLine: string | null = null
	if (current.kind === 'beforeShift' && current.remainingMinutes != null) {
		statusLine = formatCountdown(current.remainingMinutes, 'start')
	} else if (current.kind === 'inShift' && current.remainingMinutes != null) {
		statusLine = formatCountdown(current.remainingMinutes, 'end')
	}

	const completedMeta =
		current.kind === 'afterShift' && hoursLine
			? `${current.displayDay.shift.name} • ${hoursLine}`
			: null

	const overtimeMinutes =
		today.override?.type === 'overtime' ? today.override.overtimeMinutes : 0

	const next = findNextWorkShift(schedule, todayDate, overrides)

	return {
		todayDate,
		tomorrowDate,
		today,
		tomorrow,
		activeDay: current.displayDay,
		timeState: current.kind,
		headline: buildHeadline(current.kind, current.displayDay),
		hoursLine: current.kind === 'afterShift' ? null : hoursLine,
		statusLine,
		completedMeta,
		durationLine: showWorkMeta
			? formatDurationMinutes(effectiveWorkMinutes(current.displayDay))
			: null,
		breakLine:
			showWorkMeta &&
			current.displayDay.shift.breakMinutes > 0 &&
			current.displayDay.override?.type !== 'overtime'
				? `Перерыв: ${current.displayDay.shift.breakMinutes} мин`
				: null,
		overtimeLine:
			overtimeMinutes > 0
				? `+${formatDurationMinutes(overtimeMinutes)}`
				: null,
		note: today.override?.note ?? null,
		next,
		nextWhen: formatNextWhen(todayDate, next),
		nextTitle: next.found ? formatShiftTitle(next.shift) : null,
		nextEmptyMessage: next.found ? null : formatNextWorkShift(todayDate, next),
		tomorrowLine: formatTomorrowLine(tomorrow),
	}
}
