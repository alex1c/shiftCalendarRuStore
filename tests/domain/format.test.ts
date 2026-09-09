/**
 * Display helpers for cycles and Russian civil dates.
 */

import {
	DEFAULT_SHIFT_TYPES,
	formatCycleArrows,
	formatCycleHyphen,
	formatCycleLetters,
	formatDayMonthYear,
	formatMonthYear,
	getStartDateHint,
	requireSchedulePreset,
} from '@/src/domain'

describe('cycle formatting', () => {
	const cycle = requireSchedulePreset('2-2').cycle

	it('renders letter, arrow, and hyphen forms', () => {
		expect(formatCycleLetters(cycle, DEFAULT_SHIFT_TYPES)).toBe(
			'Д  Д  В  В',
		)
		expect(formatCycleArrows(cycle, DEFAULT_SHIFT_TYPES)).toBe(
			'Д → Д → В → В',
		)
		expect(formatCycleHyphen(cycle, DEFAULT_SHIFT_TYPES)).toBe('Д-Д-В-В')
	})
})

describe('Russian date copy', () => {
	it('formats confirmation and header dates', () => {
		expect(formatDayMonthYear('2026-09-09')).toBe('9 сентября 2026')
		expect(formatMonthYear(2026, 9)).toBe('Сентябрь 2026')
	})

	it('explains 2/2 start-date selection', () => {
		const preset = requireSchedulePreset('2-2')
		expect(getStartDateHint(preset, DEFAULT_SHIFT_TYPES)).toBe(
			'Для графика Д-Д-В-В укажите первый день первой дневной смены.',
		)
	})
})
