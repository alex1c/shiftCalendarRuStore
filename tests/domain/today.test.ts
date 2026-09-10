/**
 * Today overview: live shift state, countdown, overnight, and next/tomorrow.
 */

import {
	DEFAULT_SHIFT_TYPES,
	SHIFT_TYPE_DAY_ID,
	SHIFT_TYPE_NIGHT_ID,
	SHIFT_TYPE_OFF_ID,
	buildDayOverride,
	createWorkScheduleFromCustom,
	createWorkScheduleFromPreset,
	findNextWorkShift,
	formatCountdown,
	getCurrentShiftState,
	getTodayOverview,
	requireSchedulePreset,
	upsertOverride,
	validateDayOverride,
	type DayOverride,
	type DayOverrideInput,
} from '@/src/domain'

const NOW_ISO = new Date('2026-09-09T12:00:00.000Z')

function localNow (
	year: number,
	month: number,
	day: number,
	hours: number,
	minutes: number,
): Date {
	return new Date(year, month - 1, day, hours, minutes, 0, 0)
}

function daySchedule () {
	return createWorkScheduleFromPreset({
		preset: requireSchedulePreset('2-2'),
		startDate: '2026-09-09',
		shiftTypes: DEFAULT_SHIFT_TYPES,
		now: NOW_ISO,
	})
}

function nightThenOff () {
	return createWorkScheduleFromCustom({
		name: 'Ночи',
		startDate: '2026-09-09',
		cycle: [SHIFT_TYPE_NIGHT_ID, SHIFT_TYPE_OFF_ID],
		shiftTypes: DEFAULT_SHIFT_TYPES,
		now: NOW_ISO,
	})
}

function onlyOff () {
	return createWorkScheduleFromCustom({
		name: 'Отдых',
		startDate: '2026-09-09',
		cycle: [SHIFT_TYPE_OFF_ID],
		shiftTypes: DEFAULT_SHIFT_TYPES,
		now: NOW_ISO,
	})
}

function overrideFrom (input: DayOverrideInput): DayOverride {
	const checked = validateDayOverride(input)
	if (!checked.ok) {
		throw new Error(checked.message)
	}
	return buildDayOverride(checked.value, null, NOW_ISO)
}

describe('shift time state', () => {
	it('is beforeShift at 06:00 for an 08:00 start', () => {
		const schedule = daySchedule()
		const state = getCurrentShiftState(
			schedule,
			{},
			localNow(2026, 9, 9, 6, 0),
		)
		expect(state.kind).toBe('beforeShift')
		expect(state.remainingMinutes).toBe(2 * 60)
		const overview = getTodayOverview(
			schedule,
			{},
			localNow(2026, 9, 9, 6, 0),
		)
		expect(overview.headline).toBe('Сегодня — Дневная смена')
		expect(overview.hoursLine).toBe('08:00–20:00')
		expect(overview.statusLine).toBe('До начала: 2 ч')
	})

	it('is inShift at 12:00 for 08:00–20:00', () => {
		const schedule = daySchedule()
		const state = getCurrentShiftState(
			schedule,
			{},
			localNow(2026, 9, 9, 12, 0),
		)
		expect(state.kind).toBe('inShift')
		expect(state.remainingMinutes).toBe(8 * 60)
		const overview = getTodayOverview(
			schedule,
			{},
			localNow(2026, 9, 9, 12, 0),
		)
		expect(overview.headline).toBe('Сейчас — Дневная смена')
		expect(overview.statusLine).toBe('До конца: 8 ч')
	})

	it('is afterShift at 21:00 for 08:00–20:00', () => {
		const schedule = daySchedule()
		const state = getCurrentShiftState(
			schedule,
			{},
			localNow(2026, 9, 9, 21, 0),
		)
		expect(state.kind).toBe('afterShift')
		const overview = getTodayOverview(
			schedule,
			{},
			localNow(2026, 9, 9, 21, 0),
		)
		expect(overview.headline).toBe('Сегодня смена завершена')
		expect(overview.completedMeta).toBe('Дневная • 08:00–20:00')
	})

	it('keeps an overnight shift active at 02:00 the next day', () => {
		const schedule = nightThenOff()
		const state = getCurrentShiftState(
			schedule,
			{},
			localNow(2026, 9, 10, 2, 0),
		)
		expect(state.kind).toBe('inShift')
		expect(state.displayDay.date).toBe('2026-09-09')
		expect(state.displayDay.shift.kind).toBe('night')
		expect(state.remainingMinutes).toBe(6 * 60)
		const overview = getTodayOverview(
			schedule,
			{},
			localNow(2026, 9, 10, 2, 0),
		)
		expect(overview.headline).toBe('Сейчас — Ночная смена')
		expect(overview.today.shift.kind).toBe('off')
	})
})

describe('tomorrow and next shift', () => {
	it('summarizes tomorrow from the effective day', () => {
		const schedule = daySchedule()
		const overview = getTodayOverview(
			schedule,
			{},
			localNow(2026, 9, 9, 12, 0),
		)
		expect(overview.tomorrowLine).toBe('Дневная • 08:00–20:00')
		expect(overview.nextWhen).toBe('Завтра, 08:00')
		expect(overview.nextTitle).toBe('Дневная смена')
	})
})

describe('overrides on today', () => {
	it('shows sick instead of the base work shift', () => {
		const schedule = daySchedule()
		const overrides = upsertOverride(
			{},
			overrideFrom({ date: '2026-09-09', type: 'sick' }),
		)
		const overview = getTodayOverview(
			schedule,
			overrides,
			localNow(2026, 9, 9, 12, 0),
		)
		expect(overview.timeState).toBe('nonWorking')
		expect(overview.headline).toBe('Сегодня — больничный')
		expect(overview.hoursLine).toBeNull()
		expect(overview.durationLine).toBeNull()
	})

	it('shows an extra shift on a cycle off day', () => {
		const schedule = daySchedule()
		const overrides = upsertOverride(
			{},
			overrideFrom({
				date: '2026-09-11',
				type: 'extraShift',
				shiftTypeId: SHIFT_TYPE_DAY_ID,
				startTime: '08:00',
				endTime: '20:00',
				breakMinutes: 30,
				note: 'Подмена за коллегу',
			}),
		)
		const overview = getTodayOverview(
			schedule,
			overrides,
			localNow(2026, 9, 11, 10, 0),
		)
		expect(overview.headline).toBe('Сейчас — дополнительная смена')
		expect(overview.hoursLine).toBe('08:00–20:00')
		expect(overview.note).toBe('Подмена за коллегу')
		expect(overview.breakLine).toBe('Перерыв: 30 мин')
	})
})

describe('countdown formatting', () => {
	it('formats minutes, hours+minutes, and whole hours', () => {
		expect(formatCountdown(45, 'start')).toBe('До начала: 45 мин')
		expect(formatCountdown(2 * 60 + 15, 'start')).toBe('До начала: 2 ч 15 мин')
		expect(formatCountdown(7 * 60, 'end')).toBe('До конца: 7 ч')
		expect(formatCountdown(60 + 5, 'end')).toBe('До конца: 1 ч 05 мин')
	})
})

describe('all-off cycle', () => {
	it('has no next work shift', () => {
		const schedule = onlyOff()
		const overview = getTodayOverview(
			schedule,
			{},
			localNow(2026, 9, 9, 12, 0),
		)
		expect(overview.headline).toBe('Сегодня — выходной')
		expect(overview.nextEmptyMessage).toBe(
			'Рабочих смен в текущем цикле нет',
		)
		expect(findNextWorkShift(schedule, '2026-09-09').found).toBe(false)
	})
})
