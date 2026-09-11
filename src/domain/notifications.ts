/**
 * Shift reminder planning — pure domain, no native notification APIs.
 *
 * Reminders fire before an effective work-shift start on the primary
 * profile only. Civil dates stay `YYYY-MM-DD`; the trigger instant is a
 * local Date built from that date + clock, then offset in milliseconds
 * so DST transitions stay on the device calendar.
 */

import type { DayOverrideMap } from '@/src/types'
import {
	addCalendarDays,
	calendarDateFromDate,
	calendarDaysBetween,
	todayCalendarDate,
} from './dates'
import { formatDayMonth, formatShiftTitle } from './format'
import { formatDurationMinutes } from './duration'
import {
	getEffectiveDay,
	isEffectiveWorkDay,
	type EffectiveDay,
} from './overrides'
import type { ScheduleProfile } from './profiles'
import { formatClockTimeFromDate, localDateTimeFromCalendarClock } from './time'

export const NOTIFICATION_SETTINGS_SCHEMA_VERSION = 1
export const NOTIFICATION_PLAN_DAYS = 30
export const MIN_REMINDER_OFFSET_MINUTES = 15
export const MAX_REMINDER_OFFSET_MINUTES = 7 * 24 * 60
export const MAX_REMINDER_OFFSETS = 2
export const DEFAULT_REMINDER_OFFSET_MINUTES = 60
export const SHIFT_REMINDER_TYPE = 'shift_reminder'

export type ReminderOffsetUnit = 'minutes' | 'hours'

export type ReminderOffsetPreset = {
	minutes: number
	label: string
}

/** Preset chips shown on the notifications screen. */
export const REMINDER_OFFSET_PRESETS: readonly ReminderOffsetPreset[] = [
	{ minutes: 24 * 60, label: 'За 24 часа' },
	{ minutes: 12 * 60, label: 'За 12 часов' },
	{ minutes: 2 * 60, label: 'За 2 часа' },
	{ minutes: 60, label: 'За 1 час' },
]

export type NotificationSettings = {
	enabled: boolean
	/** One or two offsets, minutes before shift start. */
	offsetsMinutes: number[]
	createdAt: string
	updatedAt: string
}

export type ShiftReminderData = {
	type: typeof SHIFT_REMINDER_TYPE
	profileId: string
	date: string
	offsetMinutes: number
}

export type ShiftNotificationPlanItem = {
	/** Deterministic native identifier — same inputs always match. */
	key: string
	triggerAt: Date
	title: string
	body: string
	data: ShiftReminderData
}

export type UpcomingShiftPreview = {
	shiftDate: string
	shiftStartTime: string
	shiftLine: string
	reminderLines: string[]
}

const PRESET_MINUTES: ReadonlySet<number> = new Set(
	REMINDER_OFFSET_PRESETS.map((item) => item.minutes),
)

function isPositiveInt (value: unknown): value is number {
	return typeof value === 'number' && Number.isInteger(value) && value > 0
}

/**
 * Default settings: reminders OFF, one 1-hour offset ready if the user
 * later enables them. Permission is never implied by this document.
 */
export function defaultNotificationSettings (
	now: Date = new Date(),
): NotificationSettings {
	const stamp = now.toISOString()
	return {
		enabled: false,
		offsetsMinutes: [DEFAULT_REMINDER_OFFSET_MINUTES],
		createdAt: stamp,
		updatedAt: stamp,
	}
}

/** Keep at most two unique offsets inside the allowed minute range. */
export function normalizeReminderOffsets (
	values: readonly number[],
): number[] {
	const unique = new Set<number>()
	for (const value of values) {
		if (!Number.isInteger(value)) {
			continue
		}
		if (
			value < MIN_REMINDER_OFFSET_MINUTES ||
			value > MAX_REMINDER_OFFSET_MINUTES
		) {
			continue
		}
		unique.add(value)
		if (unique.size >= MAX_REMINDER_OFFSETS) {
			break
		}
	}
	return [...unique].sort((left, right) => left - right)
}

export function isReminderOffsetUnit (
	value: unknown,
): value is ReminderOffsetUnit {
	return value === 'minutes' || value === 'hours'
}

/** Convert a custom number + unit into minutes, or null when invalid. */
export function customOffsetToMinutes (
	amount: number,
	unit: ReminderOffsetUnit,
): number | null {
	if (!Number.isInteger(amount) || amount <= 0) {
		return null
	}
	const minutes = unit === 'hours' ? amount * 60 : amount
	if (
		minutes < MIN_REMINDER_OFFSET_MINUTES ||
		minutes > MAX_REMINDER_OFFSET_MINUTES
	) {
		return null
	}
	return minutes
}

/** True when stored settings look structurally valid. */
export function isNotificationSettings (
	value: unknown,
): value is NotificationSettings {
	if (!value || typeof value !== 'object') {
		return false
	}
	const record = value as Partial<NotificationSettings>
	if (typeof record.enabled !== 'boolean') {
		return false
	}
	if (!Array.isArray(record.offsetsMinutes)) {
		return false
	}
	if (record.offsetsMinutes.some((item) => !isPositiveInt(item))) {
		return false
	}
	return (
		typeof record.createdAt === 'string' &&
		typeof record.updatedAt === 'string'
	)
}

/**
 * Repair a stored document: drop illegal offsets, cap at two, and fall
 * back to the 1-hour default when nothing usable remains.
 */
export function normalizeNotificationSettings (
	settings: NotificationSettings,
): NotificationSettings {
	const offsets = normalizeReminderOffsets(settings.offsetsMinutes)
	return {
		...settings,
		offsetsMinutes:
			offsets.length > 0 ? offsets : [DEFAULT_REMINDER_OFFSET_MINUTES],
	}
}

/** Primary profile only — never fall back to a secondary "first" profile. */
export function findNotificationProfile (
	profiles: readonly ScheduleProfile[],
): ScheduleProfile | null {
	return profiles.find((item) => item.isPrimary) ?? null
}

/**
 * Stable native identifier. Underscores only so Android accepts it as a
 * notification id; structured fields also live in `data`.
 */
export function notificationKey (
	profileId: string,
	date: string,
	offsetMinutes: number,
): string {
	return `shift_reminder_${profileId}_${date}_${offsetMinutes}`
}

/**
 * Instant the reminder should fire: local shift start minus offset.
 * Millisecond subtraction follows civil clock math (08:00 − 12h → 20:00
 * the previous day) and stays DST-safe because `shiftStart` was built
 * with the local Date constructor, not a UTC wall-clock rewrite.
 */
export function reminderTriggerAt (
	shiftStart: Date,
	offsetMinutes: number,
): Date {
	return new Date(shiftStart.getTime() - offsetMinutes * 60 * 1000)
}

function reminderTitle (shiftStart: Date, triggerAt: Date): string {
	const shiftDay = calendarDateFromDate(shiftStart)
	const triggerDay = calendarDateFromDate(triggerAt)
	const days = calendarDaysBetween(triggerDay, shiftDay)
	if (days === 0) {
		return 'Смена сегодня'
	}
	if (days === 1) {
		return 'Смена завтра'
	}
	return `Смена ${formatDayMonth(shiftDay)}`
}

function reminderShiftLabel (day: EffectiveDay): string {
	if (day.override?.type === 'extraShift') {
		return 'Дополнительная смена'
	}
	return formatShiftTitle(day.shift)
}

function reminderBody (day: EffectiveDay, startTime: string): string {
	return `${reminderShiftLabel(day)} в ${startTime}`
}

export function formatDayMonthClock (iso: string, clock: string): string {
	return `${formatDayMonth(iso)}, ${clock}`
}

/** Today-tab caption when reminders are enabled. */
export function formatEnabledRemindersCaption (
	offsetsMinutes: readonly number[],
): string {
	const parts = normalizeReminderOffsets(offsetsMinutes).map((item) =>
		formatDurationMinutes(item),
	)
	if (parts.length === 0) {
		return 'Напоминания о сменах включены'
	}
	if (parts.length === 1) {
		return `Напоминание за ${parts[0]} включено`
	}
	return `Напоминания за ${parts.join(' и ')} включены`
}

function shiftStartDate (
	day: EffectiveDay,
): { startTime: string; startAt: Date } | null {
	const startTime = day.shift.startTime
	if (!startTime) {
		return null
	}
	return {
		startTime,
		startAt: localDateTimeFromCalendarClock(day.date, startTime),
	}
}

function walkPrimaryWorkDays (
	profile: ScheduleProfile,
	fromDate: string,
	windowDays: number,
): EffectiveDay[] {
	const days: EffectiveDay[] = []
	for (let index = 0; index < windowDays; index += 1) {
		const date = addCalendarDays(fromDate, index)
		const day = getEffectiveDay(
			profile.schedule,
			date,
			profile.overrides as DayOverrideMap,
		)
		if (!isEffectiveWorkDay(day)) {
			continue
		}
		days.push(day)
	}
	return days
}

export type BuildNotificationPlanInput = {
	profiles: readonly ScheduleProfile[]
	settings: NotificationSettings
	now: Date
	windowDays?: number
}

/**
 * Pure plan of local shift reminders. Native code only consumes this
 * list — it must not invent extra identifiers or duplicate rows.
 */
export function buildNotificationPlan (
	input: BuildNotificationPlanInput,
): ShiftNotificationPlanItem[] {
	const settings = normalizeNotificationSettings(input.settings)
	if (!settings.enabled) {
		return []
	}
	const profile = findNotificationProfile(input.profiles)
	if (!profile) {
		return []
	}
	const windowDays = input.windowDays ?? NOTIFICATION_PLAN_DAYS
	const fromDate = todayCalendarDate(input.now)
	const nowMs = input.now.getTime()
	const items: ShiftNotificationPlanItem[] = []

	for (const day of walkPrimaryWorkDays(profile, fromDate, windowDays)) {
		const start = shiftStartDate(day)
		if (!start) {
			continue
		}
		for (const offsetMinutes of settings.offsetsMinutes) {
			const triggerAt = reminderTriggerAt(start.startAt, offsetMinutes)
			if (triggerAt.getTime() <= nowMs) {
				continue
			}
			items.push({
				key: notificationKey(profile.id, day.date, offsetMinutes),
				triggerAt,
				title: reminderTitle(start.startAt, triggerAt),
				body: reminderBody(day, start.startTime),
				data: {
					type: SHIFT_REMINDER_TYPE,
					profileId: profile.id,
					date: day.date,
					offsetMinutes,
				},
			})
		}
	}

	items.sort((left, right) => {
		const byTime = left.triggerAt.getTime() - right.triggerAt.getTime()
		if (byTime !== 0) {
			return byTime
		}
		return left.key.localeCompare(right.key)
	})
	return items
}

/**
 * Next upcoming primary work shift plus still-future reminder instants.
 * Used by the settings preview; independent of native scheduling.
 */
export function buildUpcomingShiftPreview (
	input: BuildNotificationPlanInput,
): UpcomingShiftPreview | null {
	const settings = normalizeNotificationSettings(input.settings)
	const profile = findNotificationProfile(input.profiles)
	if (!profile) {
		return null
	}
	const windowDays = input.windowDays ?? NOTIFICATION_PLAN_DAYS
	const fromDate = todayCalendarDate(input.now)
	const nowMs = input.now.getTime()

	for (const day of walkPrimaryWorkDays(profile, fromDate, windowDays)) {
		const start = shiftStartDate(day)
		if (!start || start.startAt.getTime() <= nowMs) {
			continue
		}
		const reminderLines = settings.offsetsMinutes
			.map((offsetMinutes) => ({
				offsetMinutes,
				triggerAt: reminderTriggerAt(start.startAt, offsetMinutes),
			}))
			.filter((item) => item.triggerAt.getTime() > nowMs)
			.sort(
				(left, right) =>
					left.triggerAt.getTime() - right.triggerAt.getTime(),
			)
			.map((item) =>
				`Напоминание: ${formatDayMonthClock(
					calendarDateFromDate(item.triggerAt),
					formatClockTimeFromDate(item.triggerAt),
				)}`,
			)
		return {
			shiftDate: day.date,
			shiftStartTime: start.startTime,
			shiftLine: formatDayMonthClock(day.date, start.startTime),
			reminderLines,
		}
	}
	return null
}

export function isPresetOffsetMinutes (minutes: number): boolean {
	return PRESET_MINUTES.has(minutes)
}
