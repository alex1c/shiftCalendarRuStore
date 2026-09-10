/**
 * Day overrides sit on top of the cycle and must not shift later days.
 */

import {
	DEFAULT_SHIFT_TYPES,
	SHIFT_TYPE_DAY_ID,
	buildDayOverride,
	computeMonthStats,
	createWorkScheduleFromPreset,
	effectiveWorkMinutes,
	findNextWorkShift,
	formatTodaySummary,
	getEffectiveDay,
	isEffectiveWorkDay,
	removeOverrideAtDate,
	requireSchedulePreset,
	resolveShiftForDate,
	upsertOverride,
	validateDayOverride,
	type DayOverride,
	type DayOverrideInput,
	type DayOverrideMap,
} from '@/src/domain'

const NOW = new Date('2026-09-01T12:00:00.000Z')

function presetSchedule () {
	return createWorkScheduleFromPreset({
		preset: requireSchedulePreset('2-2'),
		startDate: '2026-09-01',
		shiftTypes: DEFAULT_SHIFT_TYPES,
		now: NOW,
	})
}

function overrideFrom (input: DayOverrideInput): DayOverride {
	const checked = validateDayOverride(input)
	if (!checked.ok) {
		throw new Error(checked.message)
	}
	return buildDayOverride(checked.value, null, NOW)
}

describe('override does not shift the cycle', () => {
	it('keeps later days on the original 2/2 sequence', () => {
		const schedule = presetSchedule()
		const override = overrideFrom({
			date: '2026-09-03',
			type: 'work',
			shiftTypeId: SHIFT_TYPE_DAY_ID,
			startTime: '08:00',
			endTime: '20:00',
		})
		const overrides: DayOverrideMap = upsertOverride({}, override)

		expect(resolveShiftForDate(schedule, '2026-09-01').shortName).toBe('Д')
		expect(resolveShiftForDate(schedule, '2026-09-02').shortName).toBe('Д')
		expect(resolveShiftForDate(schedule, '2026-09-03').shortName).toBe('В')
		expect(resolveShiftForDate(schedule, '2026-09-04').shortName).toBe('В')
		expect(resolveShiftForDate(schedule, '2026-09-05').shortName).toBe('Д')

		const day3 = getEffectiveDay(schedule, '2026-09-03', overrides)
		expect(day3.isOverridden).toBe(true)
		expect(day3.shift.shortName).toBe('Д')
		expect(day3.baseShift.shortName).toBe('В')

		expect(getEffectiveDay(schedule, '2026-09-04', overrides).shift.shortName).toBe('В')
		expect(getEffectiveDay(schedule, '2026-09-05', overrides).shift.shortName).toBe('Д')
	})
})

describe('restore base', () => {
	it('returns the cycle shift after the override is removed', () => {
		const schedule = presetSchedule()
		const override = overrideFrom({
			date: '2026-09-01',
			type: 'vacation',
		})
		const withOverride = upsertOverride({}, override)
		expect(getEffectiveDay(schedule, '2026-09-01', withOverride).shift.name).toBe(
			'Отпуск',
		)
		const restored = removeOverrideAtDate(withOverride, '2026-09-01')
		const day = getEffectiveDay(schedule, '2026-09-01', restored)
		expect(day.isOverridden).toBe(false)
		expect(day.shift.shortName).toBe('Д')
	})
})

describe('vacation over work', () => {
	it('makes a work day non-working with zero duration', () => {
		const schedule = presetSchedule()
		const override = overrideFrom({
			date: '2026-09-01',
			type: 'vacation',
		})
		const day = getEffectiveDay(
			schedule,
			'2026-09-01',
			upsertOverride({}, override),
		)
		expect(day.baseShift.kind).toBe('day')
		expect(day.shift.name).toBe('Отпуск')
		expect(day.shift.shortName).toBe('ОТП')
		expect(isEffectiveWorkDay(day)).toBe(false)
		expect(effectiveWorkMinutes(day)).toBe(0)
		expect(formatTodaySummary(day.shift)).toBe('Сегодня — Отпуск')
	})
})

describe('extra shift over off', () => {
	it('turns a cycle off day into paid work', () => {
		const schedule = presetSchedule()
		const override = overrideFrom({
			date: '2026-09-03',
			type: 'extraShift',
			shiftTypeId: SHIFT_TYPE_DAY_ID,
			startTime: '08:00',
			endTime: '20:00',
			breakMinutes: 0,
		})
		const day = getEffectiveDay(
			schedule,
			'2026-09-03',
			upsertOverride({}, override),
		)
		expect(day.baseShift.kind).toBe('off')
		expect(day.shift.name).toBe('Доп. смена')
		expect(isEffectiveWorkDay(day)).toBe(true)
		expect(effectiveWorkMinutes(day)).toBe(12 * 60)
	})
})

describe('next shift with overrides', () => {
	it('skips a vacation that covers the next cycle work day', () => {
		const schedule = presetSchedule()
		const override = overrideFrom({
			date: '2026-09-02',
			type: 'vacation',
		})
		const next = findNextWorkShift(
			schedule,
			'2026-09-01',
			upsertOverride({}, override),
		)
		expect(next.found && next.date).toBe('2026-09-05')
	})

	it('sees an extra shift on a cycle off day', () => {
		const schedule = presetSchedule()
		const override = overrideFrom({
			date: '2026-09-03',
			type: 'extraShift',
			startTime: '08:00',
			endTime: '20:00',
		})
		const next = findNextWorkShift(
			schedule,
			'2026-09-02',
			upsertOverride({}, override),
		)
		expect(next.found && next.date).toBe('2026-09-03')
	})
})

describe('month stats with overrides', () => {
	it('drops hours when a work day becomes vacation', () => {
		const schedule = presetSchedule()
		const baseline = computeMonthStats(schedule, 2026, 9)
		expect(baseline.workShifts).toBe(16)
		expect(baseline.offDays).toBe(14)

		const vacation = overrideFrom({
			date: '2026-09-01',
			type: 'vacation',
		})
		const afterVacation = computeMonthStats(
			schedule,
			2026,
			9,
			upsertOverride({}, vacation),
		)
		expect(afterVacation.workShifts).toBe(15)
		expect(afterVacation.offDays).toBe(15)
		expect(afterVacation.workMinutes).toBe(15 * 12 * 60)

		const extra = overrideFrom({
			date: '2026-09-03',
			type: 'extraShift',
			startTime: '08:00',
			endTime: '20:00',
		})
		const afterExtra = computeMonthStats(
			schedule,
			2026,
			9,
			upsertOverride({}, extra),
		)
		expect(afterExtra.workShifts).toBe(17)
		expect(afterExtra.offDays).toBe(13)
		expect(afterExtra.workMinutes).toBe(17 * 12 * 60)
	})
})

describe('overtime minutes', () => {
	it('adds extra minutes on top of the base work shift', () => {
		const schedule = presetSchedule()
		const override = overrideFrom({
			date: '2026-09-01',
			type: 'overtime',
			overtimeMinutes: 180,
		})
		const day = getEffectiveDay(
			schedule,
			'2026-09-01',
			upsertOverride({}, override),
		)
		expect(day.shift.shortName).toBe('ПР')
		expect(effectiveWorkMinutes(day)).toBe(12 * 60 + 180)
	})
})