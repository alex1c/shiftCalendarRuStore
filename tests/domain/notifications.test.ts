/**
 * Domain tests for the pure shift-reminder plan.
 * Native expo-notifications is not imported here.
 */

import {
	DEFAULT_SHIFT_TYPES,
	SHIFT_TYPE_DAY_ID,
	buildDayOverride,
	buildNotificationPlan,
	buildScheduleProfile,
	buildUpcomingShiftPreview,
	calendarDateFromDate,
	createWorkScheduleFromPreset,
	customOffsetToMinutes,
	defaultNotificationSettings,
	formatClockTimeFromDate,
	formatEnabledRemindersCaption,
	notificationKey,
	normalizeReminderOffsets,
	reminderTriggerAt,
	requireSchedulePreset,
	upsertOverride,
	validateDayOverride,
	type DayOverride,
	type DayOverrideInput,
	type NotificationSettings,
} from '@/src/domain'
import { localDateTimeFromCalendarClock } from '@/src/domain/time'

const STAMP = new Date('2026-09-01T12:00:00.000Z')

function twoTwo (startDate = '2026-09-12') {
	return createWorkScheduleFromPreset({
		preset: requireSchedulePreset('2-2'),
		startDate,
		shiftTypes: DEFAULT_SHIFT_TYPES,
		now: STAMP,
	})
}

function dayNight (startDate = '2026-09-11') {
	return createWorkScheduleFromPreset({
		preset: requireSchedulePreset('day-night-48'),
		startDate,
		shiftTypes: DEFAULT_SHIFT_TYPES,
		now: STAMP,
	})
}

function overrideFrom (input: DayOverrideInput): DayOverride {
	const checked = validateDayOverride(input)
	if (!checked.ok) {
		throw new Error(checked.message)
	}
	return buildDayOverride(checked.value, null, STAMP)
}

function enabledSettings (
	offsetsMinutes: number[],
	now = STAMP,
): NotificationSettings {
	return {
		...defaultNotificationSettings(now),
		enabled: true,
		offsetsMinutes,
	}
}

function primaryMe (startDate = '2026-09-12') {
	return buildScheduleProfile({
		name: 'Я',
		schedule: twoTwo(startDate),
		accent: 'blue',
		isPrimary: true,
		now: STAMP,
	})
}

describe('reminder trigger math', () => {
	it('fires one hour before an 08:00 shift', () => {
		const start = localDateTimeFromCalendarClock('2026-09-12', '08:00')
		const trigger = reminderTriggerAt(start, 60)
		expect(calendarDateFromDate(trigger)).toBe('2026-09-12')
		expect(formatClockTimeFromDate(trigger)).toBe('07:00')
	})

	it('crosses into the previous calendar day for a 12h offset', () => {
		const start = localDateTimeFromCalendarClock('2026-09-12', '08:00')
		const trigger = reminderTriggerAt(start, 720)
		expect(calendarDateFromDate(trigger)).toBe('2026-09-11')
		expect(formatClockTimeFromDate(trigger)).toBe('20:00')
	})

	it('fires two hours before a 20:00 night shift', () => {
		const start = localDateTimeFromCalendarClock('2026-09-12', '20:00')
		const trigger = reminderTriggerAt(start, 120)
		expect(calendarDateFromDate(trigger)).toBe('2026-09-12')
		expect(formatClockTimeFromDate(trigger)).toBe('18:00')
	})
})

describe('buildNotificationPlan', () => {
	it('schedules a 1h reminder at 07:00 for an 08:00 day shift', () => {
		const me = primaryMe()
		const now = new Date(2026, 8, 11, 12, 0, 0, 0)
		const plan = buildNotificationPlan({
			profiles: [me],
			settings: enabledSettings([60]),
			now,
		})
		const first = plan.find((item) => item.data.date === '2026-09-12')
		expect(first).toBeDefined()
		expect(formatClockTimeFromDate(first!.triggerAt)).toBe('07:00')
		expect(calendarDateFromDate(first!.triggerAt)).toBe('2026-09-12')
		expect(first!.title).toBe('Смена сегодня')
		expect(first!.body).toBe('Дневная смена в 08:00')
		expect(first!.data).toEqual({
			type: 'shift_reminder',
			profileId: me.id,
			date: '2026-09-12',
			offsetMinutes: 60,
		})
		expect(first!.key).toBe(notificationKey(me.id, '2026-09-12', 60))
	})

	it('places a 12h reminder on the previous evening', () => {
		const me = primaryMe()
		const now = new Date(2026, 8, 11, 12, 0, 0, 0)
		const plan = buildNotificationPlan({
			profiles: [me],
			settings: enabledSettings([720]),
			now,
		})
		const first = plan.find((item) => item.data.date === '2026-09-12')
		expect(first).toBeDefined()
		expect(calendarDateFromDate(first!.triggerAt)).toBe('2026-09-11')
		expect(formatClockTimeFromDate(first!.triggerAt)).toBe('20:00')
		expect(first!.title).toBe('Смена завтра')
	})

	it('schedules a night-shift reminder at 18:00', () => {
		const me = buildScheduleProfile({
			name: 'Я',
			schedule: dayNight('2026-09-11'),
			accent: 'blue',
			isPrimary: true,
			now: STAMP,
		})
		const now = new Date(2026, 8, 11, 12, 0, 0, 0)
		const plan = buildNotificationPlan({
			profiles: [me],
			settings: enabledSettings([120]),
			now,
		})
		const night = plan.find((item) => item.data.date === '2026-09-12')
		expect(night).toBeDefined()
		expect(formatClockTimeFromDate(night!.triggerAt)).toBe('18:00')
		expect(night!.body).toBe('Ночная смена в 20:00')
	})

	it('does not notify a vacation override over a work day', () => {
		const base = primaryMe()
		const me = {
			...base,
			overrides: upsertOverride(
				{},
				overrideFrom({ date: '2026-09-12', type: 'vacation' }),
			),
		}
		const now = new Date(2026, 8, 11, 12, 0, 0, 0)
		const plan = buildNotificationPlan({
			profiles: [me],
			settings: enabledSettings([60]),
			now,
		})
		expect(plan.some((item) => item.data.date === '2026-09-12')).toBe(false)
	})

	it('notifies an extra shift on a cycle day off', () => {
		const base = primaryMe('2026-09-10')
		const me = {
			...base,
			overrides: upsertOverride(
				{},
				overrideFrom({
					date: '2026-09-12',
					type: 'extraShift',
					shiftTypeId: SHIFT_TYPE_DAY_ID,
					startTime: '08:00',
					endTime: '20:00',
					breakMinutes: 0,
				}),
			),
		}
		const now = new Date(2026, 8, 11, 12, 0, 0, 0)
		const plan = buildNotificationPlan({
			profiles: [me],
			settings: enabledSettings([60]),
			now,
		})
		const extra = plan.find((item) => item.data.date === '2026-09-12')
		expect(extra).toBeDefined()
		expect(extra!.body).toBe('Дополнительная смена в 08:00')
	})

	it('notifies custom work', () => {
		const base = primaryMe('2026-09-10')
		const me = {
			...base,
			overrides: upsertOverride(
				{},
				overrideFrom({
					date: '2026-09-12',
					type: 'custom',
					isWork: true,
					customName: 'Вечерняя смена',
					customShortName: 'ВЧ',
					startTime: '14:00',
					endTime: '22:00',
					breakMinutes: 0,
				}),
			),
		}
		const now = new Date(2026, 8, 11, 12, 0, 0, 0)
		const plan = buildNotificationPlan({
			profiles: [me],
			settings: enabledSettings([60]),
			now,
		})
		const custom = plan.find((item) => item.data.date === '2026-09-12')
		expect(custom).toBeDefined()
		expect(custom!.body).toBe('Вечерняя смена в 14:00')
	})

	it('ignores a secondary profile even when it has work that day', () => {
		const me = {
			...primaryMe('2026-09-10'),
			overrides: upsertOverride(
				{},
				overrideFrom({ date: '2026-09-12', type: 'vacation' }),
			),
		}
		const wife = buildScheduleProfile({
			name: 'Жена',
			schedule: twoTwo('2026-09-12'),
			accent: 'green',
			isPrimary: false,
			now: STAMP,
		})
		const now = new Date(2026, 8, 11, 12, 0, 0, 0)
		const plan = buildNotificationPlan({
			profiles: [me, wife],
			settings: enabledSettings([60]),
			now,
		})
		expect(plan.some((item) => item.data.profileId === wife.id)).toBe(false)
		expect(plan.some((item) => item.data.date === '2026-09-12')).toBe(false)
	})

	it('returns nothing when only a secondary profile exists', () => {
		const wife = buildScheduleProfile({
			name: 'Жена',
			schedule: twoTwo(),
			accent: 'green',
			isPrimary: false,
			now: STAMP,
		})
		const now = new Date(2026, 8, 11, 12, 0, 0, 0)
		const plan = buildNotificationPlan({
			profiles: [wife],
			settings: enabledSettings([60]),
			now,
		})
		expect(plan).toEqual([])
	})

	it('skips a trigger that is already in the past', () => {
		const me = primaryMe()
		const now = new Date(2026, 8, 12, 10, 0, 0, 0)
		const plan = buildNotificationPlan({
			profiles: [me],
			settings: enabledSettings([60]),
			now,
		})
		expect(plan.some((item) => item.data.date === '2026-09-12')).toBe(false)
	})

	it('does not plan shifts beyond the 30-day window', () => {
		const me = primaryMe('2026-09-01')
		const now = new Date(2026, 8, 1, 6, 0, 0, 0)
		const plan = buildNotificationPlan({
			profiles: [me],
			settings: enabledSettings([60]),
			now,
		})
		expect(plan.length).toBeGreaterThan(0)
		for (const item of plan) {
			expect(item.data.date <= '2026-09-30').toBe(true)
			expect(item.data.date >= '2026-09-01').toBe(true)
		}
		expect(plan.some((item) => item.data.date === '2026-10-01')).toBe(false)
	})

	it('produces a stable key set for the same schedule and settings', () => {
		const me = primaryMe()
		const now = new Date(2026, 8, 11, 12, 0, 0, 0)
		const settings = enabledSettings([720, 60])
		const first = buildNotificationPlan({
			profiles: [me],
			settings,
			now,
		})
		const second = buildNotificationPlan({
			profiles: [me],
			settings,
			now,
		})
		expect(first.map((item) => item.key)).toEqual(
			second.map((item) => item.key),
		)
		const unique = new Set(first.map((item) => item.key))
		expect(unique.size).toBe(first.length)
	})

	it('returns an empty plan when reminders are disabled', () => {
		const me = primaryMe()
		const now = new Date(2026, 8, 11, 12, 0, 0, 0)
		const plan = buildNotificationPlan({
			profiles: [me],
			settings: defaultNotificationSettings(now),
			now,
		})
		expect(plan).toEqual([])
	})
})

describe('preview and offset helpers', () => {
	it('shows the next shift and both reminder instants', () => {
		const me = primaryMe()
		const now = new Date(2026, 8, 11, 12, 0, 0, 0)
		const preview = buildUpcomingShiftPreview({
			profiles: [me],
			settings: enabledSettings([720, 60]),
			now,
		})
		expect(preview?.shiftLine).toBe('12 сентября, 08:00')
		expect(preview?.reminderLines).toEqual([
			'Напоминание: 11 сентября, 20:00',
			'Напоминание: 12 сентября, 07:00',
		])
	})

	it('caps offsets at two legal values', () => {
		expect(normalizeReminderOffsets([60, 120, 180, 10, 20_000])).toEqual([
			60, 120,
		])
	})

	it('rejects custom offsets outside 15 minutes … 7 days', () => {
		expect(customOffsetToMinutes(10, 'minutes')).toBeNull()
		expect(customOffsetToMinutes(8 * 24, 'hours')).toBeNull()
		expect(customOffsetToMinutes(7, 'hours')).toBe(7 * 60)
		expect(customOffsetToMinutes(15, 'minutes')).toBe(15)
	})

	it('formats the Today caption', () => {
		expect(formatEnabledRemindersCaption([60])).toBe(
			'Напоминание за 1 ч включено',
		)
		expect(formatEnabledRemindersCaption([720, 60])).toBe(
			'Напоминания за 1 ч и 12 ч включены',
		)
	})
})
