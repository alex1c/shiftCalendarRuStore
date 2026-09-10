/**
 * Estimated earnings over effective days — hourly, shift-rate, extras.
 */

import {
	DEFAULT_SHIFT_TYPES,
	SHIFT_TYPE_DAY_ID,
	SHIFT_TYPE_NIGHT_ID,
	buildDayOverride,
	computeSalaryForPeriod,
	createWorkScheduleFromCustom,
	createWorkScheduleFromPreset,
	defaultSalarySettings,
	effectiveWorkMinutes,
	formatSalaryPreview,
	getEffectiveDay,
	isSalaryEnabled,
	payForMinutes,
	requireSchedulePreset,
	upsertOverride,
	validateDayOverride,
	type DayOverride,
	type DayOverrideInput,
	type SalarySettings,
} from '@/src/domain'

const STAMP = new Date('2026-09-01T12:00:00.000Z')
const HOURLY_450 = 45_000
const SHIFT_5000 = 500_000

function twoTwo (startDate = '2026-09-01') {
	return createWorkScheduleFromPreset({
		preset: requireSchedulePreset('2-2'),
		startDate,
		shiftTypes: DEFAULT_SHIFT_TYPES,
		now: STAMP,
	})
}

function dayNight (startDate = '2026-09-01') {
	return createWorkScheduleFromPreset({
		preset: requireSchedulePreset('day-night-48'),
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

function hourly (partial: Partial<SalarySettings> = {}): SalarySettings {
	return {
		...defaultSalarySettings(STAMP),
		enabled: true,
		mode: 'hourly',
		hourlyRateMinor: HOURLY_450,
		...partial,
	}
}

function perShift (partial: Partial<SalarySettings> = {}): SalarySettings {
	return {
		...defaultSalarySettings(STAMP),
		enabled: true,
		mode: 'shift',
		shiftRateMinor: SHIFT_5000,
		...partial,
	}
}

function pay (
	settings: SalarySettings,
	overrides: ReturnType<typeof upsertOverride> = {},
	startDate = '2026-09-01',
	endDate = '2026-09-01',
	schedule = twoTwo(),
) {
	return computeSalaryForPeriod(
		schedule,
		overrides,
		settings,
		startDate,
		endDate,
	)
}

describe('hourly mode', () => {
	it('pays 450 ₽ × 12 h as 5 400 ₽', () => {
		const totals = pay(hourly())
		expect(totals.regularMinutes).toBe(12 * 60)
		expect(totals.regularPayMinor).toBe(540_000)
		expect(totals.totalPayMinor).toBe(540_000)
	})

	it('pays 450 ₽ × 7 h 30 min as 3 375 ₽', () => {
		const schedule = createWorkScheduleFromCustom({
			name: 'Короткая',
			startDate: '2026-09-01',
			cycle: ['short'],
			shiftTypes: [
				{
					id: 'short',
					name: 'Короткая',
					shortName: 'КР',
					kind: 'day',
					startTime: '08:00',
					endTime: '16:00',
					breakMinutes: 30,
					color: 'day',
				},
			],
			now: STAMP,
		})
		const totals = pay(hourly(), {}, '2026-09-01', '2026-09-01', schedule)
		expect(totals.regularMinutes).toBe(7 * 60 + 30)
		expect(totals.regularPayMinor).toBe(337_500)
	})

	it('adds 20% night bonus on a 12 h night shift', () => {
		const totals = pay(
			hourly({ nightBonusEnabled: true, nightBonusBps: 2_000 }),
			{},
			'2026-09-02',
			'2026-09-02',
			dayNight(),
		)
		expect(totals.nightShifts).toBe(1)
		expect(totals.regularPayMinor).toBe(540_000)
		expect(totals.nightBonusMinor).toBe(108_000)
		expect(totals.totalPayMinor).toBe(648_000)
	})
})

describe('vacation and sick are unpaid', () => {
	it('pays 0 ₽ when a work day is overridden as vacation', () => {
		const totals = pay(
			hourly(),
			upsertOverride(
				{},
				overrideFrom({ date: '2026-09-01', type: 'vacation' }),
			),
		)
		expect(totals.regularPayMinor).toBe(0)
		expect(totals.totalPayMinor).toBe(0)
	})

	it('pays 0 ₽ for sick and day-off overrides', () => {
		const sick = pay(
			hourly(),
			upsertOverride(
				{},
				overrideFrom({ date: '2026-09-01', type: 'sick' }),
			),
		)
		const dayOff = pay(
			hourly(),
			upsertOverride(
				{},
				overrideFrom({ date: '2026-09-01', type: 'dayOff' }),
			),
		)
		expect(sick.totalPayMinor).toBe(0)
		expect(dayOff.totalPayMinor).toBe(0)
	})
})

describe('extra shift', () => {
	it('pays hourly extra duration of 11 h 30 min', () => {
		const totals = pay(
			hourly(),
			upsertOverride(
				{},
				overrideFrom({
					date: '2026-09-03',
					type: 'extraShift',
					shiftTypeId: SHIFT_TYPE_DAY_ID,
					startTime: '08:00',
					endTime: '20:00',
					breakMinutes: 30,
				}),
			),
			'2026-09-03',
			'2026-09-03',
		)
		expect(totals.extraShifts).toBe(1)
		expect(totals.extraShiftMinutes).toBe(11 * 60 + 30)
		expect(totals.regularPayMinor).toBe(0)
		expect(totals.extraShiftPayMinor).toBe(517_500)
		expect(totals.totalPayMinor).toBe(517_500)
	})

	it('applies a 1.5× extra-shift multiplier', () => {
		const totals = pay(
			hourly({ extraShiftMultiplierHundredths: 150 }),
			upsertOverride(
				{},
				overrideFrom({
					date: '2026-09-03',
					type: 'extraShift',
					shiftTypeId: SHIFT_TYPE_DAY_ID,
					startTime: '08:00',
					endTime: '20:00',
					breakMinutes: 30,
				}),
			),
			'2026-09-03',
			'2026-09-03',
		)
		expect(totals.extraShiftPayMinor).toBe(776_250)
	})
})

describe('overtime without double-count', () => {
	it('pays 12 h regular + 2 h overtime at 1.5×, not 14 h + overtime', () => {
		const overtime = overrideFrom({
			date: '2026-09-01',
			type: 'overtime',
			overtimeMinutes: 120,
		})
		const overrides = upsertOverride({}, overtime)
		const schedule = twoTwo()
		const totals = pay(
			hourly({
				overtimeEnabled: true,
				overtimeMultiplierHundredths: 150,
			}),
			overrides,
		)
		const day = getEffectiveDay(schedule, '2026-09-01', overrides)
		const combinedMinutes = effectiveWorkMinutes(day)
		expect(combinedMinutes).toBe(14 * 60)
		expect(totals.regularMinutes).toBe(12 * 60)
		expect(totals.overtimeMinutes).toBe(120)
		expect(totals.regularPayMinor).toBe(540_000)
		expect(totals.overtimePayMinor).toBe(135_000)
		expect(totals.totalPayMinor).toBe(675_000)
		const doubleCounted =
			payForMinutes(combinedMinutes, HOURLY_450) +
			totals.overtimePayMinor
		expect(totals.totalPayMinor).not.toBe(doubleCounted)
	})

	it('does not apply night bonus to overtime minutes', () => {
		const totals = pay(
			hourly({
				nightBonusEnabled: true,
				nightBonusBps: 2_000,
				overtimeEnabled: true,
				overtimeMultiplierHundredths: 150,
			}),
			upsertOverride(
				{},
				overrideFrom({
					date: '2026-09-02',
					type: 'overtime',
					overtimeMinutes: 120,
				}),
			),
			'2026-09-02',
			'2026-09-02',
			dayNight(),
		)
		expect(totals.regularPayMinor).toBe(540_000)
		expect(totals.nightBonusMinor).toBe(108_000)
		expect(totals.overtimePayMinor).toBe(135_000)
		expect(totals.totalPayMinor).toBe(783_000)
	})
})

describe('per-shift mode', () => {
	it('pays one shift rate per ordinary work day', () => {
		const totals = pay(perShift(), {}, '2026-09-01', '2026-09-02')
		expect(totals.regularShifts).toBe(2)
		expect(totals.regularPayMinor).toBe(1_000_000)
		expect(totals.totalPayMinor).toBe(1_000_000)
	})

	it('does not invent a second shift rate from overtime', () => {
		const totals = pay(
			perShift({
				overtimeEnabled: true,
				overtimeMultiplierHundredths: 150,
				overtimeHourlyRateMinor: 60_000,
			}),
			upsertOverride(
				{},
				overrideFrom({
					date: '2026-09-01',
					type: 'overtime',
					overtimeMinutes: 120,
				}),
			),
		)
		expect(totals.regularPayMinor).toBe(SHIFT_5000)
		expect(totals.overtimePayMinor).toBe(180_000)
		expect(totals.totalPayMinor).toBe(680_000)
	})

	it('leaves overtime unpaid when the hourly overtime rate is missing', () => {
		const totals = pay(
			perShift({ overtimeEnabled: true }),
			upsertOverride(
				{},
				overrideFrom({
					date: '2026-09-01',
					type: 'overtime',
					overtimeMinutes: 120,
				}),
			),
		)
		expect(totals.overtimeMinutes).toBe(120)
		expect(totals.overtimePayMinor).toBe(0)
		expect(totals.regularPayMinor).toBe(SHIFT_5000)
	})

	it('pays extra shifts at the shift rate times the multiplier', () => {
		const totals = pay(
			perShift({ extraShiftMultiplierHundredths: 150 }),
			upsertOverride(
				{},
				overrideFrom({
					date: '2026-09-03',
					type: 'extraShift',
					shiftTypeId: SHIFT_TYPE_DAY_ID,
					startTime: '08:00',
					endTime: '20:00',
				}),
			),
			'2026-09-03',
			'2026-09-03',
		)
		expect(totals.extraShiftPayMinor).toBe(750_000)
		expect(totals.regularPayMinor).toBe(0)
	})
})

describe('custom work', () => {
	it('pays hourly custom duration minus break', () => {
		const totals = pay(
			hourly(),
			upsertOverride(
				{},
				overrideFrom({
					date: '2026-09-03',
					type: 'custom',
					isWork: true,
					customName: 'Подмена',
					customShortName: 'ПД',
					startTime: '08:00',
					endTime: '20:00',
					breakMinutes: 30,
				}),
			),
			'2026-09-03',
			'2026-09-03',
		)
		expect(totals.regularMinutes).toBe(11 * 60 + 30)
		expect(totals.regularPayMinor).toBe(517_500)
		expect(totals.nightBonusMinor).toBe(0)
	})

	it('counts custom work as one shift rate', () => {
		const totals = pay(
			perShift(),
			upsertOverride(
				{},
				overrideFrom({
					date: '2026-09-03',
					type: 'custom',
					isWork: true,
					customName: 'Подмена',
					customShortName: 'ПД',
					startTime: '08:00',
					endTime: '20:00',
					breakMinutes: 30,
				}),
			),
			'2026-09-03',
			'2026-09-03',
		)
		expect(totals.regularShifts).toBe(1)
		expect(totals.regularPayMinor).toBe(SHIFT_5000)
	})
})

describe('salary feature gating', () => {
	it('does not treat missing or disabled settings as 0 ₽ earnings', () => {
		expect(isSalaryEnabled(null)).toBe(false)
		expect(isSalaryEnabled(defaultSalarySettings(STAMP))).toBe(false)
		expect(isSalaryEnabled(hourly({ enabled: false }))).toBe(false)
		expect(pay(hourly({ enabled: false })).totalPayMinor).toBe(0)
	})

	it('builds a 12 h preview from the hourly rate and night bonus', () => {
		const lines = formatSalaryPreview(
			hourly({ nightBonusEnabled: true, nightBonusBps: 2_000 }),
		)
		expect(lines[0]).toContain('5 400 ₽')
		expect(lines[1]).toContain('6 480 ₽')
	})
})

describe('work override is paid', () => {
	it('pays a work override over a cycle off day', () => {
		const totals = pay(
			hourly(),
			upsertOverride(
				{},
				overrideFrom({
					date: '2026-09-03',
					type: 'work',
					shiftTypeId: SHIFT_TYPE_NIGHT_ID,
					startTime: '20:00',
					endTime: '08:00',
				}),
			),
			'2026-09-03',
			'2026-09-03',
		)
		expect(totals.regularMinutes).toBe(12 * 60)
		expect(totals.nightShifts).toBe(1)
		expect(totals.regularPayMinor).toBe(540_000)
	})
})
