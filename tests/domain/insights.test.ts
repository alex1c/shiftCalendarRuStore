/**
 * Next-shift scan and month statistics — uses the existing cycle engine.
 */

import {
	DEFAULT_SHIFT_TYPES,
	SHIFT_TYPE_OFF_ID,
	computeMonthStats,
	createWorkScheduleFromCustom,
	createWorkScheduleFromPreset,
	findNextWorkShift,
	formatMonthStats,
	formatNextWorkShift,
	formatTodaySummary,
	formatWeekdayDayMonth,
	requireSchedulePreset,
} from '@/src/domain'

function presetSchedule (
	presetId: string,
	startDate: string,
) {
	return createWorkScheduleFromPreset({
		preset: requireSchedulePreset(presetId),
		startDate,
		shiftTypes: DEFAULT_SHIFT_TYPES,
		now: new Date('2026-09-01T12:00:00.000Z'),
	})
}

describe('month stats', () => {
	it('counts 2/2 work days, hours and offs in September 2026', () => {
		const schedule = presetSchedule('2-2', '2026-09-01')
		const stats = computeMonthStats(schedule, 2026, 9)
		expect(stats.workShifts).toBe(16)
		expect(stats.offDays).toBe(14)
		expect(stats.workMinutes).toBe(16 * 12 * 60)
		expect(formatMonthStats(stats)).toBe('16 смен • 192 ч • 14 выходных')
	})

	it('handles leap February 2028', () => {
		const schedule = presetSchedule('2-2', '2028-02-01')
		const stats = computeMonthStats(schedule, 2028, 2)
		expect(stats.workShifts + stats.offDays).toBe(29)
		expect(stats.workShifts).toBe(15)
		expect(stats.offDays).toBe(14)
	})

	it('counts custom work minutes after subtracting a break', () => {
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
			now: new Date('2026-09-01T12:00:00.000Z'),
		})
		const stats = computeMonthStats(schedule, 2026, 9)
		expect(stats.workShifts).toBe(15)
		expect(stats.offDays).toBe(15)
		expect(stats.workMinutes).toBe(15 * (7 * 60 + 30))
	})
})

describe('next work shift', () => {
	it('finds the next day shift after a stretch of offs', () => {
		const schedule = presetSchedule('2-2', '2026-09-01')
		const next = findNextWorkShift(schedule, '2026-09-03')
		expect(next.found).toBe(true)
		if (!next.found) {
			return
		}
		expect(next.date).toBe('2026-09-05')
		expect(next.shift.kind).toBe('day')
		expect(formatNextWorkShift('2026-09-04', next)).toBe(
			'Следующая смена: завтра, 08:00',
		)
		expect(formatNextWorkShift('2026-09-03', next)).toBe(
			'Следующая смена: 5 сентября, 08:00',
		)
	})

	it('skips several offs in a 1/3 cycle', () => {
		const schedule = presetSchedule('1-3', '2026-09-01')
		const next = findNextWorkShift(schedule, '2026-09-01')
		expect(next.found && next.date).toBe('2026-09-05')
	})

	it('returns a clear state for an only-off cycle', () => {
		const schedule = createWorkScheduleFromCustom({
			name: 'Отдых',
			startDate: '2026-09-01',
			cycle: [SHIFT_TYPE_OFF_ID],
			shiftTypes: DEFAULT_SHIFT_TYPES,
			now: new Date('2026-09-01T12:00:00.000Z'),
		})
		const next = findNextWorkShift(schedule, '2026-09-01')
		expect(next.found).toBe(false)
		expect(formatNextWorkShift('2026-09-01', next)).toBe(
			'Рабочих смен в текущем цикле нет',
		)
	})

	it('crosses January into February', () => {
		const schedule = presetSchedule('2-2', '2026-01-30')
		const next = findNextWorkShift(schedule, '2026-01-31')
		expect(next.found && next.date).toBe('2026-02-03')
	})

	it('crosses December into January', () => {
		const schedule = presetSchedule('2-2', '2025-12-30')
		const next = findNextWorkShift(schedule, '2025-12-31')
		expect(next.found && next.date).toBe('2026-01-03')
	})
})

describe('calendar copy', () => {
	it('formats weekday + date and today summary', () => {
		expect(formatWeekdayDayMonth('2026-09-09')).toBe('Среда, 9 сентября')
		const day = DEFAULT_SHIFT_TYPES[0]
		const off = DEFAULT_SHIFT_TYPES[2]
		expect(formatTodaySummary(day!)).toBe('Сегодня — Дневная')
		expect(formatTodaySummary(off!)).toBe('Сегодня — выходной')
	})
})
