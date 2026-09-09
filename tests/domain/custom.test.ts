/**
 * Custom shift and cycle builder validation — independent of React.
 */

import {
	DEFAULT_SHIFT_TYPES,
	MAX_CYCLE_LENGTH,
	SHIFT_TYPE_DAY_ID,
	SHIFT_TYPE_NIGHT_ID,
	SHIFT_TYPE_OFF_ID,
	addCalendarDays,
	appendCycleItem,
	applyCustomShiftEdits,
	canAppendCycleItem,
	collectUsedShiftTypes,
	createCustomShiftType,
	createWorkScheduleFromCustom,
	duplicateCycleItem,
	moveCycleItem,
	removeCycleItem,
	resolveShiftFromCycle,
	sanitizeScheduleName,
	shiftDurationMinutes,
	validateCustomShift,
	validateCycleForSave,
} from '@/src/domain'
import type { ShiftType } from '@/src/types'

const EVENING: ShiftType = {
	id: 'evening',
	name: 'Вечерняя',
	shortName: 'Вч',
	kind: 'custom',
	startTime: '14:00',
	endTime: '22:00',
	breakMinutes: 30,
	color: 'evening',
}

const CUSTOM_CATALOG: ShiftType[] = [
	...DEFAULT_SHIFT_TYPES,
	EVENING,
]

function letter (
	startDate: string,
	cycle: readonly string[],
	shiftTypes: readonly ShiftType[],
	targetDate: string,
): string {
	return resolveShiftFromCycle(
		startDate,
		cycle,
		shiftTypes,
		targetDate,
	).shortName
}

describe('custom shift validation', () => {
	const valid = {
		name: 'Вечерняя',
		shortName: 'Вч',
		startTime: '14:00',
		endTime: '22:00',
		breakMinutes: 30,
		color: 'evening',
	}

	it('accepts a well-formed custom shift', () => {
		expect(validateCustomShift(valid).ok).toBe(true)
	})

	it('requires a non-empty trimmed name', () => {
		expect(validateCustomShift({ ...valid, name: '   ' }).ok).toBe(false)
	})

	it('accepts a 1-character short name and rejects 4 characters', () => {
		expect(validateCustomShift({ ...valid, shortName: 'В' }).ok).toBe(true)
		expect(validateCustomShift({ ...valid, shortName: 'Вечр' }).ok).toBe(
			false,
		)
	})

	it('rejects an empty short name after trim', () => {
		expect(validateCustomShift({ ...valid, shortName: '  ' }).ok).toBe(
			false,
		)
	})

	it('rejects invalid clock times', () => {
		expect(
			validateCustomShift({ ...valid, startTime: '25:00' }).ok,
		).toBe(false)
		expect(
			validateCustomShift({ ...valid, endTime: '8:00' }).ok,
		).toBe(false)
	})

	it('allows overnight 20:00–08:00', () => {
		const result = validateCustomShift({
			...valid,
			startTime: '20:00',
			endTime: '08:00',
			breakMinutes: 60,
		})
		expect(result.ok).toBe(true)
		expect(shiftDurationMinutes('20:00', '08:00')).toBe(12 * 60)
	})

	it('rejects a break longer than the shift', () => {
		expect(
			validateCustomShift({
				...valid,
				startTime: '08:00',
				endTime: '10:00',
				breakMinutes: 180,
			}).ok,
		).toBe(false)
	})
})

describe('custom cycle Д Д Н Н В В В В', () => {
	const cycle = [
		SHIFT_TYPE_DAY_ID,
		SHIFT_TYPE_DAY_ID,
		SHIFT_TYPE_NIGHT_ID,
		SHIFT_TYPE_NIGHT_ID,
		SHIFT_TYPE_OFF_ID,
		SHIFT_TYPE_OFF_ID,
		SHIFT_TYPE_OFF_ID,
		SHIFT_TYPE_OFF_ID,
	]
	const start = '2026-09-01'

	it('repeats across several full cycles', () => {
		const letters: string[] = []
		for (let index = 0; index < 16; index += 1) {
			letters.push(
				letter(
					start,
					cycle,
					DEFAULT_SHIFT_TYPES,
					addCalendarDays(start, index),
				),
			)
		}
		expect(letters).toEqual([
			'Д', 'Д', 'Н', 'Н', 'В', 'В', 'В', 'В',
			'Д', 'Д', 'Н', 'Н', 'В', 'В', 'В', 'В',
		])
	})

	it('continues backward before startDate', () => {
		expect(letter(start, cycle, DEFAULT_SHIFT_TYPES, '2026-08-31')).toBe('В')
		expect(letter(start, cycle, DEFAULT_SHIFT_TYPES, '2026-08-30')).toBe('В')
		expect(letter(start, cycle, DEFAULT_SHIFT_TYPES, '2026-08-24')).toBe('Д')
	})
})

describe('one-item custom cycle', () => {
	it('returns Д on every day, including before startDate', () => {
		const cycle = [SHIFT_TYPE_DAY_ID]
		expect(letter('2026-09-09', cycle, DEFAULT_SHIFT_TYPES, '2026-09-09')).toBe('Д')
		expect(letter('2026-09-09', cycle, DEFAULT_SHIFT_TYPES, '2026-09-10')).toBe('Д')
		expect(letter('2026-09-09', cycle, DEFAULT_SHIFT_TYPES, '2026-09-01')).toBe('Д')
	})
})

describe('custom evening / off sequence', () => {
	const cycle = ['evening', SHIFT_TYPE_OFF_ID]

	it('alternates evening and off', () => {
		expect(letter('2026-09-01', cycle, CUSTOM_CATALOG, '2026-09-01')).toBe('Вч')
		expect(letter('2026-09-01', cycle, CUSTOM_CATALOG, '2026-09-02')).toBe('В')
		expect(letter('2026-09-01', cycle, CUSTOM_CATALOG, '2026-09-03')).toBe('Вч')
		expect(letter('2026-09-01', cycle, CUSTOM_CATALOG, '2026-08-31')).toBe('В')
	})
})

describe('cycle length limits', () => {
	it('rejects an empty cycle', () => {
		const result = validateCycleForSave([], DEFAULT_SHIFT_TYPES)
		expect(result.ok).toBe(false)
		expect(() => {
			createWorkScheduleFromCustom({
				name: 'Работа',
				startDate: '2026-09-09',
				cycle: [],
				shiftTypes: DEFAULT_SHIFT_TYPES,
			})
		}).toThrow('Добавьте хотя бы одну смену.')
	})

	it('allows 31 days and rejects the 32nd', () => {
		const cycle31 = Array.from(
			{ length: MAX_CYCLE_LENGTH },
			() => SHIFT_TYPE_DAY_ID,
		)
		expect(validateCycleForSave(cycle31, DEFAULT_SHIFT_TYPES).ok).toBe(true)
		expect(canAppendCycleItem(MAX_CYCLE_LENGTH).ok).toBe(false)
		expect(appendCycleItem(cycle31, SHIFT_TYPE_OFF_ID).ok).toBe(false)
	})
})

describe('builder list operations', () => {
	it('moves, duplicates, and removes items', () => {
		let cycle = [SHIFT_TYPE_DAY_ID, SHIFT_TYPE_NIGHT_ID, SHIFT_TYPE_OFF_ID]
		cycle = moveCycleItem(cycle, 2, -1)
		expect(cycle).toEqual([
			SHIFT_TYPE_DAY_ID,
			SHIFT_TYPE_OFF_ID,
			SHIFT_TYPE_NIGHT_ID,
		])
		const duplicated = duplicateCycleItem(cycle, 0)
		if (!duplicated.ok) {
			throw new Error(duplicated.message)
		}
		expect(duplicated.cycle[0]).toBe(SHIFT_TYPE_DAY_ID)
		expect(duplicated.cycle[duplicated.cycle.length - 1]).toBe(
			SHIFT_TYPE_DAY_ID,
		)
		expect(removeCycleItem(cycle, 1)).toEqual([
			SHIFT_TYPE_DAY_ID,
			SHIFT_TYPE_NIGHT_ID,
		])
	})

	it('keeps a single catalog entry for a repeated custom type', () => {
		const cycle = ['evening', 'evening', SHIFT_TYPE_OFF_ID]
		const used = collectUsedShiftTypes(cycle, CUSTOM_CATALOG)
		expect(used.map((shift) => shift.id)).toEqual([
			'evening',
			SHIFT_TYPE_OFF_ID,
		])
	})
})

describe('custom schedule factory', () => {
	it('persists presetId custom and a sanitized name', () => {
		const created = createCustomShiftType({
			name: 'Вечерняя',
			shortName: 'Вч',
			startTime: '14:00',
			endTime: '22:00',
			breakMinutes: 0,
			color: 'evening',
		})
		if (!created.ok) {
			throw new Error(created.message)
		}
		const schedule = createWorkScheduleFromCustom({
			name: '  Работа  ',
			startDate: '2026-09-09',
			cycle: [created.shift.id, SHIFT_TYPE_OFF_ID],
			shiftTypes: [...DEFAULT_SHIFT_TYPES, created.shift],
			now: new Date('2026-09-09T12:00:00.000Z'),
		})
		expect(schedule.presetId).toBe('custom')
		expect(schedule.name).toBe('Работа')
		expect(schedule.cycle).toHaveLength(2)
	})

	it('falls back to Мой график when the name is blank', () => {
		expect(sanitizeScheduleName('   ')).toBe('Мой график')
	})

	it('keeps the original id when editing a custom shift', () => {
		const created = createCustomShiftType({
			name: 'Вечерняя',
			shortName: 'Вч',
			startTime: '14:00',
			endTime: '22:00',
			breakMinutes: 0,
			color: 'evening',
		})
		if (!created.ok) {
			throw new Error(created.message)
		}
		const edited = applyCustomShiftEdits(created.shift, {
			name: 'Поздняя',
			shortName: 'П',
			startTime: '16:00',
			endTime: '00:00',
			breakMinutes: 15,
			color: 'late',
		})
		if (!edited.ok) {
			throw new Error(edited.message)
		}
		expect(edited.shift.id).toBe(created.shift.id)
		expect(edited.shift.name).toBe('Поздняя')
		expect(edited.shift.shortName).toBe('П')
	})
})
