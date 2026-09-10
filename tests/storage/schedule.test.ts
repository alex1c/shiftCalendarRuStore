/**
 * Storage round-trip tests for the active work schedule.
 */

import AsyncStorage from '@react-native-async-storage/async-storage'

import {
	CUSTOM_PRESET_ID,
	DEFAULT_SHIFT_TYPES,
	SHIFT_TYPE_OFF_ID,
	createWorkScheduleFromCustom,
	createWorkScheduleFromPreset,
	requireSchedulePreset,
	upsertOverride,
	validateDayOverride,
	buildDayOverride,
} from '@/src/domain'
import {
	STORAGE_KEYS,
	STORAGE_SCHEMA_VERSION,
	clearAllStorageForTests,
	clearWorkSchedule,
	getDayOverrides,
	getWorkSchedule,
	saveDayOverrides,
	saveWorkSchedule,
} from '@/src/storage'

describe('work schedule storage', () => {
	beforeEach(async () => {
		await clearAllStorageForTests()
	})

	it('returns null when no schedule has been created', async () => {
		await expect(getWorkSchedule()).resolves.toBeNull()
	})

	it('persists and reloads a schedule created from a preset', async () => {
		const schedule = createWorkScheduleFromPreset({
			preset: requireSchedulePreset('2-2'),
			startDate: '2026-09-09',
			shiftTypes: DEFAULT_SHIFT_TYPES,
			now: new Date('2026-09-09T12:00:00.000Z'),
		})
		await saveWorkSchedule(schedule)
		await expect(getWorkSchedule()).resolves.toEqual(schedule)
	})

	it('clears the schedule so onboarding can run again', async () => {
		const schedule = createWorkScheduleFromPreset({
			preset: requireSchedulePreset('1-1'),
			startDate: '2026-09-01',
		})
		await saveWorkSchedule(schedule)
		await clearWorkSchedule()
		await expect(getWorkSchedule()).resolves.toBeNull()
	})

	it('reloads a Phase 1 preset payload written as raw JSON', async () => {
		const legacy = createWorkScheduleFromPreset({
			preset: requireSchedulePreset('2-2'),
			startDate: '2026-09-01',
			now: new Date('2026-09-01T12:00:00.000Z'),
		})
		await AsyncStorage.setItem(
			STORAGE_KEYS.schedule,
			JSON.stringify(legacy),
		)
		await expect(getWorkSchedule()).resolves.toEqual(legacy)
	})

	it('persists and reloads a custom schedule', async () => {
		const evening = {
			id: 'evening',
			name: 'Вечерняя',
			shortName: 'Вч',
			kind: 'custom' as const,
			startTime: '14:00',
			endTime: '22:00',
			breakMinutes: 0,
			color: 'evening',
		}
		const schedule = createWorkScheduleFromCustom({
			name: 'Работа',
			startDate: '2026-09-09',
			cycle: [evening.id, evening.id, SHIFT_TYPE_OFF_ID, SHIFT_TYPE_OFF_ID],
			shiftTypes: [...DEFAULT_SHIFT_TYPES, evening],
			now: new Date('2026-09-09T12:00:00.000Z'),
		})
		expect(schedule.presetId).toBe(CUSTOM_PRESET_ID)
		await saveWorkSchedule(schedule)
		const loaded = await getWorkSchedule()
		expect(loaded).toEqual(schedule)
		expect(loaded?.shiftTypes.map((item) => item.id)).toEqual([
			'evening',
			SHIFT_TYPE_OFF_ID,
		])
	})
})

describe('day override storage', () => {
	beforeEach(async () => {
		await clearAllStorageForTests()
	})

	it('persists and reloads an override by date', async () => {
		const checked = validateDayOverride({
			date: '2026-09-12',
			type: 'vacation',
			note: 'Подмена за Сергея',
		})
		expect(checked.ok).toBe(true)
		if (!checked.ok) {
			return
		}
		const override = buildDayOverride(
			checked.value,
			null,
			new Date('2026-09-01T12:00:00.000Z'),
		)
		await saveDayOverrides(upsertOverride({}, override))
		const loaded = await getDayOverrides()
		expect(loaded['2026-09-12']).toEqual(override)
	})

	it('clears overrides together with the schedule', async () => {
		const schedule = createWorkScheduleFromPreset({
			preset: requireSchedulePreset('2-2'),
			startDate: '2026-09-01',
		})
		const checked = validateDayOverride({
			date: '2026-09-01',
			type: 'sick',
		})
		if (!checked.ok) {
			throw new Error(checked.message)
		}
		await saveWorkSchedule(schedule)
		await saveDayOverrides(
			upsertOverride(
				{},
				buildDayOverride(checked.value, null),
			),
		)
		await clearWorkSchedule()
		await expect(getWorkSchedule()).resolves.toBeNull()
		await expect(getDayOverrides()).resolves.toEqual({})
	})

	it('still loads a Phase 1 schedule after the schema bump', async () => {
		const legacy = createWorkScheduleFromPreset({
			preset: requireSchedulePreset('2-2'),
			startDate: '2026-09-01',
			now: new Date('2026-09-01T12:00:00.000Z'),
		})
		await AsyncStorage.setItem(
			STORAGE_KEYS.meta,
			JSON.stringify({ schemaVersion: 1 }),
		)
		await AsyncStorage.setItem(
			STORAGE_KEYS.schedule,
			JSON.stringify(legacy),
		)
		await expect(getWorkSchedule()).resolves.toEqual(legacy)
		await expect(getDayOverrides()).resolves.toEqual({})
		const metaRaw = await AsyncStorage.getItem(STORAGE_KEYS.meta)
		expect(JSON.parse(metaRaw ?? '{}')).toEqual({
			schemaVersion: STORAGE_SCHEMA_VERSION,
		})
	})
})
