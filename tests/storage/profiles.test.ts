/**
 * Profile storage: v2 → v3 migration, active id, delete, salary binding.
 */

import AsyncStorage from '@react-native-async-storage/async-storage'

import {
	DEFAULT_PRIMARY_PROFILE_NAME,
	DEFAULT_SHIFT_TYPES,
	buildDayOverride,
	createWorkScheduleFromPreset,
	defaultSalarySettings,
	requireSchedulePreset,
	upsertOverride,
	validateDayOverride,
} from '@/src/domain'
import {
	STORAGE_KEYS,
	STORAGE_SCHEMA_VERSION,
	clearAllStorageForTests,
	clearWorkSchedule,
	getActiveProfileId,
	getDayOverrides,
	getProfiles,
	getSalarySettings,
	getWorkSchedule,
	saveActiveProfileId,
	saveProfiles,
	saveSalarySettings,
	saveWorkSchedule,
} from '@/src/storage'

const STAMP = new Date('2026-09-01T12:00:00.000Z')

function twoTwo () {
	return createWorkScheduleFromPreset({
		preset: requireSchedulePreset('2-2'),
		startDate: '2026-09-01',
		shiftTypes: DEFAULT_SHIFT_TYPES,
		now: STAMP,
	})
}

describe('profile migration', () => {
	beforeEach(async () => {
		await clearAllStorageForTests()
	})

	it('migrates a v2 schedule and overrides into primary profile Я', async () => {
		const schedule = twoTwo()
		const checked = validateDayOverride({
			date: '2026-09-01',
			type: 'vacation',
		})
		if (!checked.ok) {
			throw new Error(checked.message)
		}
		const override = buildDayOverride(checked.value, null, STAMP)
		await AsyncStorage.setItem(
			STORAGE_KEYS.meta,
			JSON.stringify({ schemaVersion: 2 }),
		)
		await AsyncStorage.setItem(
			STORAGE_KEYS.schedule,
			JSON.stringify(schedule),
		)
		await AsyncStorage.setItem(
			STORAGE_KEYS.overrides,
			JSON.stringify({ byDate: upsertOverride({}, override) }),
		)
		const loaded = await getWorkSchedule()
		expect(loaded).toEqual(schedule)
		const profiles = await getProfiles()
		expect(profiles).toHaveLength(1)
		expect(profiles[0]?.name).toBe(DEFAULT_PRIMARY_PROFILE_NAME)
		expect(profiles[0]?.isPrimary).toBe(true)
		expect(profiles[0]?.overrides['2026-09-01']).toEqual(override)
		expect(await getDayOverrides()).toEqual(
			upsertOverride({}, override),
		)
		const metaRaw = await AsyncStorage.getItem(STORAGE_KEYS.meta)
		expect(JSON.parse(metaRaw ?? '{}')).toEqual({
			schemaVersion: STORAGE_SCHEMA_VERSION,
		})
	})

	it('binds existing salary settings to the migrated primary profile', async () => {
		const schedule = twoTwo()
		const salary = {
			...defaultSalarySettings(STAMP),
			enabled: true,
			hourlyRateMinor: 45_000,
		}
		await AsyncStorage.setItem(
			STORAGE_KEYS.schedule,
			JSON.stringify(schedule),
		)
		await saveSalarySettings(salary)
		await clearAllStorageForTests()
		await AsyncStorage.setItem(
			STORAGE_KEYS.schedule,
			JSON.stringify(schedule),
		)
		await AsyncStorage.setItem(
			STORAGE_KEYS.salary,
			JSON.stringify({ schemaVersion: 1, settings: salary }),
		)
		const profiles = await getProfiles()
		const loadedSalary = await getSalarySettings()
		expect(profiles[0]?.isPrimary).toBe(true)
		expect(loadedSalary?.hourlyRateMinor).toBe(45_000)
		expect(loadedSalary?.profileId).toBe(profiles[0]?.id)
	})
})

describe('active profile persistence', () => {
	beforeEach(async () => {
		await clearAllStorageForTests()
	})

	it('persists and reloads the active profile id', async () => {
		const first = twoTwo()
		await saveWorkSchedule(first)
		const created = await getProfiles()
		const secondSchedule = createWorkScheduleFromPreset({
			preset: requireSchedulePreset('day-night-48'),
			startDate: '2026-09-01',
			now: STAMP,
		})
		const second = {
			...created[0]!,
			id: 'prf_wife',
			name: 'Жена',
			isPrimary: false,
			accent: 'green' as const,
			schedule: secondSchedule,
			overrides: {},
		}
		await saveProfiles([created[0]!, second])
		await saveActiveProfileId(second.id)
		expect(await getActiveProfileId()).toBe(second.id)
		expect(await getWorkSchedule()).toEqual(secondSchedule)
	})

	it('falls back when the stored active id is corrupt', async () => {
		await saveWorkSchedule(twoTwo())
		const profiles = await getProfiles()
		await AsyncStorage.setItem(
			STORAGE_KEYS.activeProfile,
			'{not-json',
		)
		expect(await getActiveProfileId()).toBe(profiles[0]?.id)
	})
})

describe('delete profile', () => {
	beforeEach(async () => {
		await clearAllStorageForTests()
	})

	it('removes a secondary profile and its overrides', async () => {
		await saveWorkSchedule(twoTwo())
		const primary = (await getProfiles())[0]!
		const wifeSchedule = createWorkScheduleFromPreset({
			preset: requireSchedulePreset('1-1'),
			startDate: '2026-09-01',
			now: STAMP,
		})
		const checked = validateDayOverride({
			date: '2026-09-02',
			type: 'sick',
		})
		if (!checked.ok) {
			throw new Error(checked.message)
		}
		const wife = {
			id: 'prf_wife',
			name: 'Жена',
			accent: 'green' as const,
			isPrimary: false,
			schedule: wifeSchedule,
			overrides: upsertOverride(
				{},
				buildDayOverride(checked.value, null, STAMP),
			),
			createdAt: STAMP.toISOString(),
			updatedAt: STAMP.toISOString(),
		}
		await saveProfiles([primary, wife])
		await saveActiveProfileId(wife.id)
		await saveProfiles([primary])
		await saveActiveProfileId(primary.id)
		const leftover = await getProfiles()
		expect(leftover).toHaveLength(1)
		expect(leftover[0]?.id).toBe(primary.id)
		expect(await getDayOverrides()).toEqual({})
	})

	it('falls back when the active secondary is removed', async () => {
		await saveWorkSchedule(twoTwo())
		const primary = (await getProfiles())[0]!
		const wife = {
			...primary,
			id: 'prf_wife',
			name: 'Жена',
			isPrimary: false,
			accent: 'green' as const,
		}
		await saveProfiles([primary, wife])
		await saveActiveProfileId('prf_wife')
		await saveProfiles([primary])
		expect(await getActiveProfileId()).toBe(primary.id)
	})
})

describe('schedule reset keeps salary', () => {
	beforeEach(async () => {
		await clearAllStorageForTests()
	})

	it('clears profiles without dropping salary settings', async () => {
		await saveWorkSchedule(twoTwo())
		const salary = {
			...defaultSalarySettings(STAMP),
			enabled: true,
			hourlyRateMinor: 45_000,
		}
		await saveSalarySettings(salary)
		await clearWorkSchedule()
		await expect(getWorkSchedule()).resolves.toBeNull()
		await expect(getProfiles()).resolves.toEqual([])
		const loaded = await getSalarySettings()
		expect(loaded?.hourlyRateMinor).toBe(45_000)
	})
})
