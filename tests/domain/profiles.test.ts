/**
 * Independent profiles and common days off over effective days.
 */

import {
	DEFAULT_SHIFT_TYPES,
	SHIFT_TYPE_DAY_ID,
	buildDayOverride,
	buildScheduleProfile,
	commonDaysOffInMonth,
	createWorkScheduleFromPreset,
	findCommonDaysOff,
	getEffectiveDay,
	isFreeEffectiveDay,
	profileShortLabel,
	requireSchedulePreset,
	resolveActiveProfile,
	upsertOverride,
	validateDayOverride,
	type DayOverride,
	type DayOverrideInput,
} from '@/src/domain'

const STAMP = new Date('2026-09-01T12:00:00.000Z')

function twoTwo () {
	return createWorkScheduleFromPreset({
		preset: requireSchedulePreset('2-2'),
		startDate: '2026-09-01',
		shiftTypes: DEFAULT_SHIFT_TYPES,
		now: STAMP,
	})
}

function dayNight () {
	return createWorkScheduleFromPreset({
		preset: requireSchedulePreset('day-night-48'),
		startDate: '2026-09-01',
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

describe('independent profiles', () => {
	it('keeps 2/2 and day-night-48 on their own cycles', () => {
		const me = buildScheduleProfile({
			name: 'Я',
			schedule: twoTwo(),
			accent: 'blue',
			isPrimary: true,
			now: STAMP,
		})
		const wife = buildScheduleProfile({
			name: 'Жена',
			schedule: dayNight(),
			accent: 'green',
			isPrimary: false,
			now: STAMP,
		})
		expect(getEffectiveDay(me.schedule, '2026-09-02', me.overrides).shift.kind).toBe('day')
		expect(getEffectiveDay(wife.schedule, '2026-09-02', wife.overrides).shift.kind).toBe('night')
		expect(me.id).not.toBe(wife.id)
		expect(profileShortLabel('Жена')).toBe('Ж')
		expect(profileShortLabel('Я')).toBe('Я')
	})

	it('does not leak overrides from profile A into B', () => {
		const scheduleA = twoTwo()
		const scheduleB = twoTwo()
		const vacation = overrideFrom({
			date: '2026-09-01',
			type: 'vacation',
		})
		const me = buildScheduleProfile({
			name: 'Я',
			schedule: scheduleA,
			overrides: upsertOverride({}, vacation),
			accent: 'blue',
			isPrimary: true,
			now: STAMP,
		})
		const wife = buildScheduleProfile({
			name: 'Жена',
			schedule: scheduleB,
			accent: 'green',
			isPrimary: false,
			now: STAMP,
		})
		expect(getEffectiveDay(me.schedule, '2026-09-01', me.overrides).shift.name).toBe('Отпуск')
		expect(getEffectiveDay(wife.schedule, '2026-09-01', wife.overrides).shift.kind).toBe('day')
	})

	it('falls back when the active id is missing or corrupt', () => {
		const me = buildScheduleProfile({
			name: 'Я',
			schedule: twoTwo(),
			accent: 'blue',
			isPrimary: true,
			now: STAMP,
		})
		const wife = buildScheduleProfile({
			name: 'Жена',
			schedule: dayNight(),
			accent: 'green',
			isPrimary: false,
			now: STAMP,
		})
		expect(resolveActiveProfile([me, wife], 'missing')?.id).toBe(me.id)
		expect(resolveActiveProfile([me, wife], wife.id)?.id).toBe(wife.id)
	})
})

describe('common days off', () => {
	it('finds shared off days for known 2/2 and day-night sequences', () => {
		const me = buildScheduleProfile({
			name: 'Я',
			schedule: twoTwo(),
			accent: 'blue',
			isPrimary: true,
			now: STAMP,
		})
		const wife = buildScheduleProfile({
			name: 'Жена',
			schedule: dayNight(),
			accent: 'green',
			isPrimary: false,
			now: STAMP,
		})
		expect(
			findCommonDaysOff(me, wife, '2026-09-01', '2026-09-08'),
		).toEqual(['2026-09-03', '2026-09-04', '2026-09-07', '2026-09-08'])
		expect(commonDaysOffInMonth(me, wife, 2026, 9).slice(0, 4)).toEqual([
			'2026-09-03',
			'2026-09-04',
			'2026-09-07',
			'2026-09-08',
		])
	})

	it('counts vacation as free for common off', () => {
		const vacation = overrideFrom({
			date: '2026-09-01',
			type: 'vacation',
		})
		const me = buildScheduleProfile({
			name: 'Я',
			schedule: twoTwo(),
			overrides: upsertOverride({}, vacation),
			accent: 'blue',
			isPrimary: true,
			now: STAMP,
		})
		const wife = buildScheduleProfile({
			name: 'Жена',
			schedule: twoTwo(),
			accent: 'green',
			isPrimary: false,
			now: STAMP,
		})
		expect(isFreeEffectiveDay(me.schedule, '2026-09-01', me.overrides)).toBe(true)
		expect(
			findCommonDaysOff(me, wife, '2026-09-01', '2026-09-01'),
		).toEqual([])
		const bothOff = buildScheduleProfile({
			name: 'Жена',
			schedule: twoTwo(),
			overrides: upsertOverride(
				{},
				overrideFrom({ date: '2026-09-01', type: 'sick' }),
			),
			accent: 'green',
			isPrimary: false,
			now: STAMP,
		})
		expect(
			findCommonDaysOff(me, bothOff, '2026-09-01', '2026-09-01'),
		).toEqual(['2026-09-01'])
	})

	it('treats extra shift as working, so it is not a common off', () => {
		const extra = overrideFrom({
			date: '2026-09-03',
			type: 'extraShift',
			shiftTypeId: SHIFT_TYPE_DAY_ID,
			startTime: '08:00',
			endTime: '20:00',
		})
		const me = buildScheduleProfile({
			name: 'Я',
			schedule: twoTwo(),
			overrides: upsertOverride({}, extra),
			accent: 'blue',
			isPrimary: true,
			now: STAMP,
		})
		const wife = buildScheduleProfile({
			name: 'Жена',
			schedule: twoTwo(),
			accent: 'green',
			isPrimary: false,
			now: STAMP,
		})
		expect(isFreeEffectiveDay(me.schedule, '2026-09-03', me.overrides)).toBe(false)
		expect(
			findCommonDaysOff(me, wife, '2026-09-03', '2026-09-03'),
		).toEqual([])
	})

	it('treats custom work as working', () => {
		const custom = overrideFrom({
			date: '2026-09-03',
			type: 'custom',
			isWork: true,
			customName: 'Подмена',
			customShortName: 'ПД',
			startTime: '08:00',
			endTime: '20:00',
		})
		const me = buildScheduleProfile({
			name: 'Я',
			schedule: twoTwo(),
			overrides: upsertOverride({}, custom),
			accent: 'blue',
			isPrimary: true,
			now: STAMP,
		})
		expect(isFreeEffectiveDay(me.schedule, '2026-09-03', me.overrides)).toBe(false)
	})
})
