/**
 * Versioned salary settings persistence. Independent from schedule reset.
 */

import AsyncStorage from '@react-native-async-storage/async-storage'

import {
	createWorkScheduleFromPreset,
	defaultSalarySettings,
	requireSchedulePreset,
} from '@/src/domain'
import {
	STORAGE_KEYS,
	clearAllStorageForTests,
	clearSalarySettings,
	clearWorkSchedule,
	getSalarySettings,
	getWorkSchedule,
	saveSalarySettings,
	saveWorkSchedule,
} from '@/src/storage'

const STAMP = new Date('2026-09-01T12:00:00.000Z')

function sampleSettings () {
	return {
		...defaultSalarySettings(STAMP),
		enabled: true,
		mode: 'hourly' as const,
		hourlyRateMinor: 45_000,
		nightBonusEnabled: true,
		nightBonusBps: 2_000,
	}
}

describe('salary settings storage', () => {
	beforeEach(async () => {
		await clearAllStorageForTests()
	})

	it('returns null on first run', async () => {
		await expect(getSalarySettings()).resolves.toBeNull()
	})

	it('saves, reloads, edits and can be disabled', async () => {
		const created = sampleSettings()
		await saveSalarySettings(created)
		await expect(getSalarySettings()).resolves.toEqual(created)

		const edited = {
			...created,
			hourlyRateMinor: 50_000,
			updatedAt: '2026-09-02T12:00:00.000Z',
		}
		await saveSalarySettings(edited)
		await expect(getSalarySettings()).resolves.toEqual(edited)

		await saveSalarySettings({ ...edited, enabled: false })
		const disabled = await getSalarySettings()
		expect(disabled?.enabled).toBe(false)
		expect(disabled?.hourlyRateMinor).toBe(50_000)
	})

	it('falls back when the salary document is corrupt', async () => {
		await AsyncStorage.setItem(STORAGE_KEYS.salary, '{not-json')
		await expect(getSalarySettings()).resolves.toBeNull()
		await AsyncStorage.setItem(
			STORAGE_KEYS.salary,
			JSON.stringify({ schemaVersion: 1, settings: { enabled: true } }),
		)
		await expect(getSalarySettings()).resolves.toBeNull()
	})

	it('keeps salary settings after a schedule reset', async () => {
		const schedule = createWorkScheduleFromPreset({
			preset: requireSchedulePreset('2-2'),
			startDate: '2026-09-01',
			now: STAMP,
		})
		const settings = sampleSettings()
		await saveWorkSchedule(schedule)
		await saveSalarySettings(settings)
		await clearWorkSchedule()
		await expect(getWorkSchedule()).resolves.toBeNull()
		await expect(getSalarySettings()).resolves.toEqual(settings)
	})

	it('clears salary settings only through the dedicated reset', async () => {
		await saveSalarySettings(sampleSettings())
		await clearSalarySettings()
		await expect(getSalarySettings()).resolves.toBeNull()
	})
})
