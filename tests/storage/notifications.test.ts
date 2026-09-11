/**
 * Versioned notification settings persistence. Independent from schedule reset.
 */

import AsyncStorage from '@react-native-async-storage/async-storage'

import {
	createWorkScheduleFromPreset,
	defaultNotificationSettings,
	requireSchedulePreset,
} from '@/src/domain'
import {
	STORAGE_KEYS,
	clearAllStorageForTests,
	clearWorkSchedule,
	getNotificationSettings,
	getWorkSchedule,
	saveNotificationSettings,
	saveWorkSchedule,
} from '@/src/storage'

const STAMP = new Date('2026-09-01T12:00:00.000Z')

function sampleSettings () {
	return {
		...defaultNotificationSettings(STAMP),
		enabled: true,
		offsetsMinutes: [60, 720],
	}
}

describe('notification settings storage', () => {
	beforeEach(async () => {
		await clearAllStorageForTests()
	})

	it('returns null on first run', async () => {
		await expect(getNotificationSettings()).resolves.toBeNull()
	})

	it('saves, reloads and can be disabled', async () => {
		const created = sampleSettings()
		await saveNotificationSettings(created)
		await expect(getNotificationSettings()).resolves.toEqual(created)

		await saveNotificationSettings({ ...created, enabled: false })
		const disabled = await getNotificationSettings()
		expect(disabled?.enabled).toBe(false)
		expect(disabled?.offsetsMinutes).toEqual([60, 720])
	})

	it('falls back when the notifications document is corrupt', async () => {
		await AsyncStorage.setItem(STORAGE_KEYS.notifications, '{not-json')
		await expect(getNotificationSettings()).resolves.toBeNull()
		await AsyncStorage.setItem(
			STORAGE_KEYS.notifications,
			JSON.stringify({ schemaVersion: 1, settings: { enabled: true } }),
		)
		await expect(getNotificationSettings()).resolves.toBeNull()
	})

	it('drops illegal offsets and keeps a valid default pair', async () => {
		await AsyncStorage.setItem(
			STORAGE_KEYS.notifications,
			JSON.stringify({
				schemaVersion: 1,
				settings: {
					enabled: true,
					offsetsMinutes: [10, 60, 120, 99_999],
					createdAt: STAMP.toISOString(),
					updatedAt: STAMP.toISOString(),
				},
			}),
		)
		const loaded = await getNotificationSettings()
		expect(loaded?.offsetsMinutes).toEqual([60, 120])
	})

	it('keeps notification settings after a schedule reset', async () => {
		const schedule = createWorkScheduleFromPreset({
			preset: requireSchedulePreset('2-2'),
			startDate: '2026-09-01',
			now: STAMP,
		})
		const settings = sampleSettings()
		await saveWorkSchedule(schedule)
		await saveNotificationSettings(settings)
		await clearWorkSchedule()
		await expect(getWorkSchedule()).resolves.toBeNull()
		await expect(getNotificationSettings()).resolves.toEqual({
			...settings,
			offsetsMinutes: [60, 720],
		})
	})
})
