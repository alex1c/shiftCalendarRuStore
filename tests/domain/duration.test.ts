/**
 * Work duration and compact hour formatting.
 */

import {
	DEFAULT_SHIFT_TYPES,
	formatDurationMinutes,
	isWorkShift,
	requireDefaultShiftType,
	shiftDurationMinutes,
	workDurationMinutes,
} from '@/src/domain'
import type { ShiftType } from '@/src/types'

const evening: ShiftType = {
	id: 'evening',
	name: 'Вечерняя',
	shortName: 'ВЧ',
	kind: 'custom',
	startTime: '14:00',
	endTime: '22:00',
	breakMinutes: 30,
	color: 'evening',
}

describe('shift duration', () => {
	it('counts a day shift as 12 hours', () => {
		const day = requireDefaultShiftType('day')
		expect(shiftDurationMinutes('08:00', '20:00')).toBe(12 * 60)
		expect(workDurationMinutes(day)).toBe(12 * 60)
		expect(isWorkShift(day)).toBe(true)
	})

	it('counts a night shift that crosses midnight as 12 hours', () => {
		const night = requireDefaultShiftType('night')
		expect(shiftDurationMinutes('20:00', '08:00')).toBe(12 * 60)
		expect(workDurationMinutes(night)).toBe(12 * 60)
	})

	it('subtracts a custom break from the clock span', () => {
		expect(shiftDurationMinutes('14:00', '22:00')).toBe(8 * 60)
		expect(workDurationMinutes(evening)).toBe(7 * 60 + 30)
	})

	it('treats an off day as zero work minutes', () => {
		const off = requireDefaultShiftType('off')
		expect(isWorkShift(off)).toBe(false)
		expect(workDurationMinutes(off)).toBe(0)
	})
})

describe('duration formatting', () => {
	it('formats whole hours without decimals', () => {
		expect(formatDurationMinutes(12 * 60)).toBe('12 ч')
		expect(formatDurationMinutes(168 * 60)).toBe('168 ч')
		expect(formatDurationMinutes(0)).toBe('0 ч')
	})

	it('formats hours and minutes', () => {
		expect(formatDurationMinutes(7 * 60 + 30)).toBe('7 ч 30 мин')
		expect(formatDurationMinutes(30)).toBe('30 мин')
	})
})

describe('default catalog still has three built-in types', () => {
	it('keeps day / night / off', () => {
		expect(DEFAULT_SHIFT_TYPES).toHaveLength(3)
	})
})
