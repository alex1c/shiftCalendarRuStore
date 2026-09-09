/**
 * Calendar-date arithmetic tests.
 */

import {
	addCalendarDays,
	addMonths,
	buildMonthGrid,
	calendarDaysBetween,
	daysInMonth,
	formatCalendarDate,
	mondayFirstWeekday,
	parseCalendarDate,
	todayCalendarDate,
} from '@/src/domain'

describe('parseCalendarDate', () => {
	it('parses a valid ISO civil date', () => {
		expect(parseCalendarDate('2026-09-09')).toEqual({
			year: 2026,
			month: 9,
			day: 9,
		})
	})

	it('rejects malformed and impossible dates', () => {
		expect(() => parseCalendarDate('2026/09/09')).toThrow()
		expect(() => parseCalendarDate('2026-09-31')).toThrow()
		expect(() => parseCalendarDate('2025-02-29')).toThrow()
	})
})

describe('calendarDaysBetween / addCalendarDays', () => {
	it('returns signed day differences', () => {
		expect(calendarDaysBetween('2026-09-01', '2026-09-05')).toBe(4)
		expect(calendarDaysBetween('2026-09-01', '2026-09-01')).toBe(0)
		expect(calendarDaysBetween('2026-09-01', '2026-08-30')).toBe(-2)
	})

	it('adds days across month and year edges', () => {
		expect(addCalendarDays('2026-01-31', 1)).toBe('2026-02-01')
		expect(addCalendarDays('2025-12-31', 1)).toBe('2026-01-01')
		expect(addCalendarDays('2024-02-28', 1)).toBe('2024-02-29')
		expect(addCalendarDays('2025-02-28', 1)).toBe('2025-03-01')
	})
})

describe('month helpers', () => {
	it('reports leap and non-leap February lengths', () => {
		expect(daysInMonth(2024, 2)).toBe(29)
		expect(daysInMonth(2025, 2)).toBe(28)
	})

	it('shifts months across year boundaries', () => {
		expect(addMonths(2026, 1, -1)).toEqual({ year: 2025, month: 12 })
		expect(addMonths(2025, 12, 1)).toEqual({ year: 2026, month: 1 })
	})
})

describe('month grid', () => {
	it('starts on Monday and covers six weeks', () => {
		const cells = buildMonthGrid(2026, 9)
		expect(cells).toHaveLength(42)
		expect(mondayFirstWeekday('2026-08-31')).toBe(0)
		expect(cells[0]?.date).toBe('2026-08-31')
		expect(cells[0]?.inCurrentMonth).toBe(false)
		expect(cells[1]?.date).toBe('2026-09-01')
		expect(cells[1]?.inCurrentMonth).toBe(true)
	})

	it('keeps 1 September 2026 as Tuesday (Monday-first index 1)', () => {
		expect(mondayFirstWeekday('2026-09-01')).toBe(1)
		expect(formatCalendarDate(2026, 9, 1)).toBe('2026-09-01')
	})
})

describe('todayCalendarDate', () => {
	it('uses local Y/M/D of the provided clock', () => {
		const now = new Date(2026, 8, 9, 3, 0, 0)
		expect(todayCalendarDate(now)).toBe('2026-09-09')
	})
})
