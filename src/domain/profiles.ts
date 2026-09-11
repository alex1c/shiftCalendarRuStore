/**
 * Multiple independent schedule profiles.
 * Each profile owns its own cycle, shift types, startDate and overrides.
 * Profile ids are generated; `"me"` is never hardcoded.
 */

import type { DayOverrideMap, WorkSchedule } from '@/src/types'
import { createId } from '@/src/utils/id'
import {
	addCalendarDays,
	calendarDaysBetween,
	daysInMonth,
	formatCalendarDate,
} from './dates'
import { MAX_SCHEDULE_NAME_LENGTH } from './custom'
import {
	emptyOverrideMap,
	getEffectiveDay,
	isDayOverride,
	isEffectiveWorkDay,
} from './overrides'
import { isWorkSchedule } from './schedule'
import { clampCivilRange } from './stats'

export const DEFAULT_PRIMARY_PROFILE_NAME = 'Я'
export const DEFAULT_SECONDARY_PROFILE_NAME = 'Новый график'
export const MAX_PROFILES = 8
export const MAX_PROFILE_NAME_LENGTH = MAX_SCHEDULE_NAME_LENGTH
export const PROFILES_DOCUMENT_VERSION = 1

export const PROFILE_ACCENTS = [
	'blue',
	'green',
	'purple',
	'orange',
	'teal',
] as const

export type ProfileAccent = (typeof PROFILE_ACCENTS)[number]

export type ScheduleProfile = {
	id: string
	name: string
	accent: ProfileAccent
	isPrimary: boolean
	schedule: WorkSchedule
	overrides: DayOverrideMap
	createdAt: string
	updatedAt: string
}

export function isProfileAccent (value: unknown): value is ProfileAccent {
	return (
		typeof value === 'string' &&
		(PROFILE_ACCENTS as readonly string[]).includes(value)
	)
}

function parseOverrideMapLoose (value: unknown): DayOverrideMap {
	if (!value || typeof value !== 'object') {
		return emptyOverrideMap()
	}
	const next: DayOverrideMap = {}
	for (const [date, item] of Object.entries(value as DayOverrideMap)) {
		if (isDayOverride(item) && item.date === date) {
			next[date] = item
		}
	}
	return next
}

/** Structural guard for a persisted schedule profile. */
export function isScheduleProfile (value: unknown): value is ScheduleProfile {
	if (!value || typeof value !== 'object') {
		return false
	}
	const record = value as Partial<ScheduleProfile>
	return (
		typeof record.id === 'string' &&
		typeof record.name === 'string' &&
		isProfileAccent(record.accent) &&
		typeof record.isPrimary === 'boolean' &&
		isWorkSchedule(record.schedule) &&
		typeof record.createdAt === 'string' &&
		typeof record.updatedAt === 'string' &&
		record.overrides !== undefined
	)
}

export function normalizeScheduleProfile (
	value: ScheduleProfile,
): ScheduleProfile {
	return {
		...value,
		name: sanitizeProfileName(
			value.name,
			value.isPrimary
				? DEFAULT_PRIMARY_PROFILE_NAME
				: DEFAULT_SECONDARY_PROFILE_NAME,
		),
		overrides: parseOverrideMapLoose(value.overrides),
	}
}

export function sanitizeProfileName (
	raw: string,
	fallback: string = DEFAULT_SECONDARY_PROFILE_NAME,
): string {
	const collapsed = raw.trim().replace(/\s+/g, ' ')
	if (collapsed.length === 0) {
		return fallback
	}
	return collapsed.slice(0, MAX_PROFILE_NAME_LENGTH)
}

/** First grapheme, or the whole name when it is already 1–2 characters. */
export function profileShortLabel (name: string): string {
	const trimmed = name.trim()
	if (trimmed.length === 0) {
		return '?'
	}
	if (trimmed.length <= 2) {
		return trimmed
	}
	const first = Array.from(trimmed)[0]
	return first ?? '?'
}

export function nextProfileAccent (
	existing: readonly ScheduleProfile[],
): ProfileAccent {
	const used = new Set(existing.map((item) => item.accent))
	const unused = PROFILE_ACCENTS.find((item) => !used.has(item))
	if (unused) {
		return unused
	}
	return PROFILE_ACCENTS[existing.length % PROFILE_ACCENTS.length]!
}

export function buildScheduleProfile (input: {
	name: string
	schedule: WorkSchedule
	overrides?: DayOverrideMap
	accent: ProfileAccent
	isPrimary: boolean
	now?: Date
}): ScheduleProfile {
	const now = (input.now ?? new Date()).toISOString()
	const fallback = input.isPrimary
		? DEFAULT_PRIMARY_PROFILE_NAME
		: DEFAULT_SECONDARY_PROFILE_NAME
	return {
		id: createId('prf'),
		name: sanitizeProfileName(input.name, fallback),
		accent: input.accent,
		isPrimary: input.isPrimary,
		schedule: input.schedule,
		overrides: input.overrides ?? emptyOverrideMap(),
		createdAt: now,
		updatedAt: now,
	}
}

export function findPrimaryProfile (
	profiles: readonly ScheduleProfile[],
): ScheduleProfile | null {
	return profiles.find((item) => item.isPrimary) ?? profiles[0] ?? null
}

/**
 * Last active id when it still exists; otherwise primary, then first.
 * Corrupt / deleted ids never throw — they fall back.
 */
export function resolveActiveProfile (
	profiles: readonly ScheduleProfile[],
	activeId: string | null | undefined,
): ScheduleProfile | null {
	if (profiles.length === 0) {
		return null
	}
	if (activeId) {
		const match = profiles.find((item) => item.id === activeId)
		if (match) {
			return match
		}
	}
	return findPrimaryProfile(profiles)
}

export function replaceProfile (
	profiles: readonly ScheduleProfile[],
	next: ScheduleProfile,
): ScheduleProfile[] {
	return profiles.map((item) => (item.id === next.id ? next : item))
}

export function renameProfile (
	profile: ScheduleProfile,
	name: string,
	now: Date = new Date(),
): ScheduleProfile {
	const fallback = profile.isPrimary
		? DEFAULT_PRIMARY_PROFILE_NAME
		: DEFAULT_SECONDARY_PROFILE_NAME
	return {
		...profile,
		name: sanitizeProfileName(name, fallback),
		updatedAt: now.toISOString(),
	}
}

export function updateProfileSchedule (
	profile: ScheduleProfile,
	schedule: WorkSchedule,
	now: Date = new Date(),
): ScheduleProfile {
	return {
		...profile,
		schedule,
		updatedAt: now.toISOString(),
	}
}

export function updateProfileOverrides (
	profile: ScheduleProfile,
	overrides: DayOverrideMap,
	now: Date = new Date(),
): ScheduleProfile {
	return {
		...profile,
		overrides,
		updatedAt: now.toISOString(),
	}
}

/**
 * A day is free when the effective day is not work:
 * off, vacation, sick, dayOff, custom non-work. Extra shift is not free.
 */
export function isFreeEffectiveDay (
	schedule: WorkSchedule,
	date: string,
	overrides: DayOverrideMap,
): boolean {
	const day = getEffectiveDay(schedule, date, overrides)
	return !isEffectiveWorkDay(day)
}

/**
 * Civil dates where both profiles are non-working, inclusive.
 */
export function findCommonDaysOff (
	profileA: Pick<ScheduleProfile, 'schedule' | 'overrides'>,
	profileB: Pick<ScheduleProfile, 'schedule' | 'overrides'>,
	startDate: string,
	endDate: string,
): string[] {
	const range = clampCivilRange(startDate, endDate)
	if (!range) {
		return []
	}
	const dates: string[] = []
	const lastIndex = calendarDaysBetween(range.startDate, range.endDate)
	for (let offset = 0; offset <= lastIndex; offset += 1) {
		const date = addCalendarDays(range.startDate, offset)
		const aFree = isFreeEffectiveDay(
			profileA.schedule,
			date,
			profileA.overrides,
		)
		const bFree = isFreeEffectiveDay(
			profileB.schedule,
			date,
			profileB.overrides,
		)
		if (aFree && bFree) {
			dates.push(date)
		}
	}
	return dates
}

export function commonDaysOffInMonth (
	profileA: Pick<ScheduleProfile, 'schedule' | 'overrides'>,
	profileB: Pick<ScheduleProfile, 'schedule' | 'overrides'>,
	year: number,
	month: number,
): string[] {
	const startDate = formatCalendarDate(year, month, 1)
	const endDate = formatCalendarDate(year, month, daysInMonth(year, month))
	return findCommonDaysOff(profileA, profileB, startDate, endDate)
}
