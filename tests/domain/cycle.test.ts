/**
 * Cycle engine tests — independent of React.
 */

import {
	DEFAULT_SHIFT_TYPES,
	SCHEDULE_PRESETS,
	addCalendarDays,
	calendarDateFromDate,
	calendarDaysBetween,
	getCycleIndex,
	parseCalendarDate,
	positiveModulo,
	requireSchedulePreset,
	resolveShiftFromCycle,
} from '@/src/domain'

function letter (
	startDate: string,
	cycle: readonly string[],
	targetDate: string,
): string {
	return resolveShiftFromCycle(
		startDate,
		cycle,
		DEFAULT_SHIFT_TYPES,
		targetDate,
	).shortName
}

function lettersForward (
	startDate: string,
	cycle: readonly string[],
	days: number,
): string[] {
	const result: string[] = []
	for (let index = 0; index < days; index += 1) {
		result.push(letter(startDate, cycle, addCalendarDays(startDate, index)))
	}
	return result
}

describe('positiveModulo', () => {
	it('keeps positive remainders unchanged', () => {
		expect(positiveModulo(0, 4)).toBe(0)
		expect(positiveModulo(5, 4)).toBe(1)
	})

	it('wraps negative offsets instead of returning a negative index', () => {
		expect(positiveModulo(-1, 4)).toBe(3)
		expect(positiveModulo(-2, 4)).toBe(2)
		expect(positiveModulo(-4, 4)).toBe(0)
		expect(positiveModulo(-5, 4)).toBe(3)
	})
})

describe('2/2 cycle forward', () => {
	const cycle = requireSchedulePreset('2-2').cycle
	const start = '2026-09-01'

	it('matches Д Д В В across several full cycles', () => {
		expect(lettersForward(start, cycle, 12)).toEqual([
			'Д', 'Д', 'В', 'В',
			'Д', 'Д', 'В', 'В',
			'Д', 'Д', 'В', 'В',
		])
	})

	it('maps the documented September 2026 example', () => {
		expect(letter(start, cycle, '2026-09-01')).toBe('Д')
		expect(letter(start, cycle, '2026-09-02')).toBe('Д')
		expect(letter(start, cycle, '2026-09-03')).toBe('В')
		expect(letter(start, cycle, '2026-09-04')).toBe('В')
		expect(letter(start, cycle, '2026-09-05')).toBe('Д')
	})
})

describe('2/2 cycle backward', () => {
	const cycle = requireSchedulePreset('2-2').cycle
	const start = '2026-09-01'

	it('continues the cycle before startDate', () => {
		expect(letter(start, cycle, '2026-08-31')).toBe('В')
		expect(letter(start, cycle, '2026-08-30')).toBe('В')
		expect(letter(start, cycle, '2026-08-29')).toBe('Д')
		expect(letter(start, cycle, '2026-08-28')).toBe('Д')
		expect(letter(start, cycle, '2026-08-27')).toBe('В')
	})

	it('uses modulo rather than walking day by day', () => {
		expect(getCycleIndex(start, cycle.length, '2026-08-31')).toBe(3)
		expect(calendarDaysBetween(start, '2026-08-31')).toBe(-1)
	})
})

describe('День → Ночь → 48', () => {
	const cycle = requireSchedulePreset('day-night-48').cycle
	const start = '2026-09-01'

	it('follows Д Н В В', () => {
		expect(lettersForward(start, cycle, 8)).toEqual([
			'Д', 'Н', 'В', 'В',
			'Д', 'Н', 'В', 'В',
		])
	})

	it('continues backward from the first day shift', () => {
		expect(letter(start, cycle, '2026-08-31')).toBe('В')
		expect(letter(start, cycle, '2026-08-30')).toBe('В')
		expect(letter(start, cycle, '2026-08-29')).toBe('Н')
		expect(letter(start, cycle, '2026-08-28')).toBe('Д')
	})
})

describe('month and year boundaries', () => {
	const cycle = requireSchedulePreset('2-2').cycle

	it('crosses 31 January → 1 February', () => {
		const start = '2026-01-31'
		expect(letter(start, cycle, '2026-01-31')).toBe('Д')
		expect(letter(start, cycle, '2026-02-01')).toBe('Д')
		expect(letter(start, cycle, '2026-02-02')).toBe('В')
	})

	it('crosses 31 December → 1 January', () => {
		const start = '2025-12-31'
		expect(letter(start, cycle, '2025-12-31')).toBe('Д')
		expect(letter(start, cycle, '2026-01-01')).toBe('Д')
		expect(letter(start, cycle, '2026-01-02')).toBe('В')
	})

	it('handles leap day 28/29 February', () => {
		const start = '2024-02-28'
		expect(letter(start, cycle, '2024-02-28')).toBe('Д')
		expect(letter(start, cycle, '2024-02-29')).toBe('Д')
		expect(letter(start, cycle, '2024-03-01')).toBe('В')
		expect(letter(start, cycle, '2024-03-02')).toBe('В')
		expect(letter(start, cycle, '2024-02-27')).toBe('В')
	})

	it('does not invent 29 February in a non-leap year', () => {
		expect(() => parseCalendarDate('2025-02-29')).toThrow(
			'Invalid calendar date: 2025-02-29',
		)
		const start = '2025-02-28'
		expect(letter(start, cycle, '2025-02-28')).toBe('Д')
		expect(letter(start, cycle, '2025-03-01')).toBe('Д')
	})
})

describe('calendar date normalization', () => {
	it('ignores time of day on the local calendar date', () => {
		const morning = new Date(2026, 8, 9, 0, 5, 0)
		const evening = new Date(2026, 8, 9, 23, 59, 59)
		expect(calendarDateFromDate(morning)).toBe('2026-09-09')
		expect(calendarDateFromDate(evening)).toBe('2026-09-09')
	})

	it('does not use UTC ISO slicing that can shift the civil day', () => {
		const lateEvening = new Date(2026, 8, 9, 23, 30, 0)
		const utcIsoDay = lateEvening.toISOString().slice(0, 10)
		const civil = calendarDateFromDate(lateEvening)
		expect(civil).toBe('2026-09-09')
		if (utcIsoDay !== civil) {
			expect(utcIsoDay).not.toBe(civil)
		}
	})

	it('counts DST-adjacent civil days as whole days', () => {
		expect(calendarDaysBetween('2026-03-08', '2026-03-09')).toBe(1)
		expect(calendarDaysBetween('2026-10-31', '2026-11-01')).toBe(1)
	})
})

describe('presets catalog', () => {
	it('ships the Phase 1 built-in cycles', () => {
		expect(SCHEDULE_PRESETS.map((preset) => preset.id)).toEqual([
			'2-2',
			'1-1',
			'3-3',
			'1-3',
			'5-2',
			'day-night-48',
		])
	})
})
