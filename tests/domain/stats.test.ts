/**
 * Period stats over effective days — rolling windows, month/year, overrides.
 */

import {
	DEFAULT_SHIFT_TYPES,
	SHIFT_TYPE_OFF_ID,
	buildDayOverride,
	computePeriodStats,
	createWorkScheduleFromCustom,
	createWorkScheduleFromPreset,
	formatCivilRange,
	formatDayCount,
	formatStatsPeriodLabel,
	requireSchedulePreset,
	resolveStatsPeriod,
	upsertOverride,
	validateDayOverride,
	type DayOverride,
	type DayOverrideInput,
} from '@/src/domain'

const STAMP = new Date('2026-09-01T12:00:00.000Z')

function localNoon (year: number, month: number, day: number): Date {
	return new Date(year, month - 1, day, 12, 0, 0, 0)
}

function twoTwo (startDate: string) {
	return createWorkScheduleFromPreset({
		preset: requireSchedulePreset('2-2'),
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

describe('date ranges', () => {
	it('uses the last 7/30/90 days including today', () => {
		const now = localNoon(2026, 9, 10)
		expect(resolveStatsPeriod('7', '2026-09-01', now)).toEqual({
			startDate: '2026-09-04',
			endDate: '2026-09-10',
		})
		expect(resolveStatsPeriod('30', '2026-09-01', now)).toEqual({
			startDate: '2026-08-12',
			endDate: '2026-09-10',
		})
		expect(resolveStatsPeriod('90', '2026-09-01', now)).toEqual({
			startDate: '2026-06-13',
			endDate: '2026-09-10',
		})
		expect(formatCivilRange('2026-08-12', '2026-09-10')).toBe(
			'12 августа — 10 сентября',
		)
		expect(formatStatsPeriodLabel(
			'7',
			{ startDate: '2026-09-04', endDate: '2026-09-10' },
		)).toBe('4–10 сентября 2026')
	})

	it('uses the current month and year, including planned future days', () => {
		const now = localNoon(2026, 9, 10)
		expect(resolveStatsPeriod('month', '2026-09-01', now)).toEqual({
			startDate: '2026-09-01',
			endDate: '2026-09-30',
		})
		expect(resolveStatsPeriod('year', '2026-09-01', now)).toEqual({
			startDate: '2026-01-01',
			endDate: '2026-12-31',
		})
		expect(formatStatsPeriodLabel(
			'month',
			{ startDate: '2026-09-01', endDate: '2026-09-30' },
		)).toBe('1–30 сентября 2026')
		expect(formatStatsPeriodLabel(
			'year',
			{ startDate: '2026-01-01', endDate: '2026-12-31' },
		)).toBe('2026 год')
	})

	it('limits «all» from startDate to today', () => {
		const now = localNoon(2026, 9, 10)
		expect(resolveStatsPeriod('all', '2026-09-01', now)).toEqual({
			startDate: '2026-09-01',
			endDate: '2026-09-10',
		})
		expect(resolveStatsPeriod('all', '2026-10-01', now)).toEqual({
			startDate: '2026-10-01',
			endDate: '2026-09-10',
		})
	})
})

describe('7-day known 2/2 cycle', () => {
	it('counts work, off and hours', () => {
		const schedule = twoTwo('2026-09-01')
		const range = resolveStatsPeriod(
			'7',
			schedule.startDate,
			localNoon(2026, 9, 7),
		)
		const stats = computePeriodStats(
			schedule,
			{},
			range.startDate,
			range.endDate,
		)
		expect(stats.dayCount).toBe(7)
		expect(stats.workShifts).toBe(4)
		expect(stats.offDays).toBe(3)
		expect(stats.workMinutes).toBe(4 * 12 * 60)
		expect(stats.dayShifts).toBe(4)
		expect(stats.nightShifts).toBe(0)
	})
})

describe('30-day period', () => {
	it('matches September 2026 2/2 totals when today is the 30th', () => {
		const schedule = twoTwo('2026-09-01')
		const range = resolveStatsPeriod(
			'30',
			schedule.startDate,
			localNoon(2026, 9, 30),
		)
		expect(range).toEqual({
			startDate: '2026-09-01',
			endDate: '2026-09-30',
		})
		const stats = computePeriodStats(
			schedule,
			{},
			range.startDate,
			range.endDate,
		)
		expect(stats.workShifts).toBe(16)
		expect(stats.offDays).toBe(14)
		expect(stats.workMinutes).toBe(16 * 12 * 60)
	})
})

describe('overrides in period stats', () => {
	it('reduces work when vacation covers a work day', () => {
		const schedule = twoTwo('2026-09-01')
		const overrides = upsertOverride(
			{},
			overrideFrom({ date: '2026-09-01', type: 'vacation' }),
		)
		const stats = computePeriodStats(
			schedule,
			overrides,
			'2026-09-01',
			'2026-09-07',
		)
		expect(stats.workShifts).toBe(3)
		expect(stats.workMinutes).toBe(3 * 12 * 60)
		expect(stats.vacationDays).toBe(1)
		expect(stats.offDays).toBe(3)
	})

	it('adds work when extra shift covers an off day', () => {
		const schedule = twoTwo('2026-09-01')
		const overrides = upsertOverride(
			{},
			overrideFrom({
				date: '2026-09-03',
				type: 'extraShift',
				startTime: '08:00',
				endTime: '20:00',
			}),
		)
		const stats = computePeriodStats(
			schedule,
			overrides,
			'2026-09-01',
			'2026-09-07',
		)
		expect(stats.workShifts).toBe(5)
		expect(stats.extraShifts).toBe(1)
		expect(stats.otherWorkShifts).toBe(1)
		expect(stats.offDays).toBe(2)
		expect(stats.workMinutes).toBe(5 * 12 * 60)
	})

	it('adds overtime minutes without doubling the shift', () => {
		const schedule = twoTwo('2026-09-01')
		const overrides = upsertOverride(
			{},
			overrideFrom({
				date: '2026-09-01',
				type: 'overtime',
				overtimeMinutes: 180,
			}),
		)
		const stats = computePeriodStats(
			schedule,
			overrides,
			'2026-09-01',
			'2026-09-07',
		)
		expect(stats.workShifts).toBe(4)
		expect(stats.dayShifts).toBe(4)
		expect(stats.overtimeMinutes).toBe(180)
		expect(stats.workMinutes).toBe(4 * 12 * 60 + 180)
	})
})

describe('day/night and custom work', () => {
	it('splits a mixed day-night cycle', () => {
		const schedule = createWorkScheduleFromPreset({
			preset: requireSchedulePreset('day-night-48'),
			startDate: '2026-09-01',
			now: STAMP,
		})
		const stats = computePeriodStats(
			schedule,
			{},
			'2026-09-01',
			'2026-09-07',
		)
		expect(stats.dayShifts).toBe(2)
		expect(stats.nightShifts).toBe(2)
		expect(stats.offDays).toBe(3)
		expect(stats.workShifts).toBe(4)
	})

	it('counts a custom evening shift as other work', () => {
		const evening = {
			id: 'evening',
			name: 'Вечерняя',
			shortName: 'ВЧ',
			kind: 'custom' as const,
			startTime: '14:00',
			endTime: '22:00',
			breakMinutes: 30,
			color: 'evening' as const,
		}
		const schedule = createWorkScheduleFromCustom({
			name: 'Вечер',
			startDate: '2026-09-01',
			cycle: [evening.id, SHIFT_TYPE_OFF_ID],
			shiftTypes: [...DEFAULT_SHIFT_TYPES, evening],
			now: STAMP,
		})
		const stats = computePeriodStats(
			schedule,
			{},
			'2026-09-01',
			'2026-09-07',
		)
		expect(stats.workShifts).toBe(4)
		expect(stats.otherWorkShifts).toBe(4)
		expect(stats.dayShifts).toBe(0)
		expect(stats.offDays).toBe(3)
		expect(stats.workMinutes).toBe(4 * (7 * 60 + 30))
	})
})

describe('all-off and leap month', () => {
	it('returns zeros for an only-off cycle', () => {
		const schedule = createWorkScheduleFromCustom({
			name: 'Отдых',
			startDate: '2026-09-01',
			cycle: [SHIFT_TYPE_OFF_ID],
			shiftTypes: DEFAULT_SHIFT_TYPES,
			now: STAMP,
		})
		const stats = computePeriodStats(
			schedule,
			{},
			'2026-09-01',
			'2026-09-07',
		)
		expect(stats.workShifts).toBe(0)
		expect(stats.workMinutes).toBe(0)
		expect(stats.offDays).toBe(7)
		expect(formatDayCount(1)).toBe('1 день')
		expect(formatDayCount(2)).toBe('2 дня')
		expect(formatDayCount(5)).toBe('5 дней')
	})

	it('covers 29 days in February 2028', () => {
		const schedule = twoTwo('2028-02-01')
		const range = resolveStatsPeriod(
			'month',
			schedule.startDate,
			localNoon(2028, 2, 10),
		)
		expect(range.endDate).toBe('2028-02-29')
		const stats = computePeriodStats(
			schedule,
			{},
			range.startDate,
			range.endDate,
		)
		expect(stats.dayCount).toBe(29)
		expect(stats.workShifts).toBe(15)
		expect(stats.offDays).toBe(14)
	})

	it('returns an empty aggregate when start is after end', () => {
		const schedule = twoTwo('2026-10-01')
		const stats = computePeriodStats(
			schedule,
			{},
			'2026-10-01',
			'2026-09-10',
		)
		expect(stats.dayCount).toBe(0)
		expect(stats.workShifts).toBe(0)
	})
})
