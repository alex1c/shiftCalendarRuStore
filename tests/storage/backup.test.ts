/**
 * Backup restore storage roundtrip and notification reschedule hook.
 */

import { applyBackupRestore } from '@/src/backup'
import {
	buildBackupPayload,
	buildDayOverride,
	buildScheduleProfile,
	createWorkScheduleFromPreset,
	defaultNotificationSettings,
	defaultSalarySettings,
	prepareRestoredAppState,
	requireSchedulePreset,
	restoreBackup,
	upsertOverride,
	validateDayOverride,
} from '@/src/domain'
import {
	clearAllStorageForTests,
	getActiveProfileId,
	getNotificationSettings,
	getProfiles,
	getSalarySettings,
	replaceAppDataFromBackup,
	saveNotificationSettings,
	saveProfiles,
	saveActiveProfileId,
	saveSalarySettings,
} from '@/src/storage'

const STAMP = new Date('2026-09-11T12:00:00.000Z')

function twoTwo (startDate = '2026-09-01') {
	return createWorkScheduleFromPreset({
		preset: requireSchedulePreset('2-2'),
		startDate,
		now: STAMP,
	})
}

async function seedFullState () {
	const me = buildScheduleProfile({
		name: 'Я',
		schedule: twoTwo(),
		accent: 'blue',
		isPrimary: true,
		now: STAMP,
		overrides: upsertOverride(
			{},
			(() => {
				const checked = validateDayOverride({
					date: '2026-09-12',
					type: 'vacation',
					note: 'Отпуск',
				})
				if (!checked.ok) {
					throw new Error(checked.message)
				}
				return buildDayOverride(checked.value, null, STAMP)
			})(),
		),
	})
	const wife = buildScheduleProfile({
		name: 'Жена',
		schedule: twoTwo('2026-09-03'),
		accent: 'green',
		isPrimary: false,
		now: STAMP,
	})
	await saveProfiles([me, wife])
	await saveActiveProfileId(wife.id)
	await saveSalarySettings({
		...defaultSalarySettings(STAMP),
		enabled: true,
		hourlyRateMinor: 55_000,
		profileId: me.id,
	})
	await saveNotificationSettings({
		...defaultNotificationSettings(STAMP),
		enabled: true,
		offsetsMinutes: [60],
	})
	return { me, wife }
}

describe('backup storage roundtrip', () => {
	beforeEach(async () => {
		await clearAllStorageForTests()
	})

	it('restores profiles, active, salary, notifications and notes', async () => {
		const { me, wife } = await seedFullState()
		const payload = buildBackupPayload({
			profiles: await getProfiles(),
			activeProfileId: await getActiveProfileId(),
			salarySettings: await getSalarySettings(),
			notificationSettings: await getNotificationSettings(),
			now: STAMP,
		})
		expect(payload.data.profiles).toHaveLength(2)
		expect(payload.data.activeProfileId).toBe(wife.id)

		await clearAllStorageForTests()
		expect(await getProfiles()).toEqual([])

		const restored = restoreBackup(payload)
		expect(restored.ok).toBe(true)
		if (!restored.ok) {
			return
		}
		await replaceAppDataFromBackup(restored.value)

		const profiles = await getProfiles()
		expect(profiles).toHaveLength(2)
		expect(profiles.find((item) => item.id === me.id)?.overrides['2026-09-12']?.note)
			.toBe('Отпуск')
		expect(await getActiveProfileId()).toBe(wife.id)
		expect((await getSalarySettings())?.hourlyRateMinor).toBe(55_000)
		expect((await getNotificationSettings())?.enabled).toBe(true)
		expect((await getNotificationSettings())?.offsetsMinutes).toEqual([60])
	})

	it('calls rescheduleShiftNotifications after applyBackupRestore', async () => {
		const { me } = await seedFullState()
		const payload = buildBackupPayload({
			profiles: await getProfiles(),
			activeProfileId: me.id,
			salarySettings: await getSalarySettings(),
			notificationSettings: await getNotificationSettings(),
			now: STAMP,
		})
		await clearAllStorageForTests()

		const reschedule = jest.fn(
			async (_input: {
				profiles: unknown[]
				settings: { enabled?: boolean } | null
			}) => [],
		)
		const result = await applyBackupRestore(payload, {
			reschedule: reschedule as never,
		})
		expect(result.ok).toBe(true)
		expect(reschedule).toHaveBeenCalledTimes(1)
		const call = reschedule.mock.calls[0]?.[0]
		expect(call?.profiles).toHaveLength(2)
		expect(call?.settings?.enabled).toBe(true)
		expect(await getProfiles()).toHaveLength(2)
	})

	it('prepareRestoredAppState matches atomic write input', async () => {
		const { me } = await seedFullState()
		const payload = buildBackupPayload({
			profiles: await getProfiles(),
			activeProfileId: me.id,
			salarySettings: await getSalarySettings(),
			notificationSettings: await getNotificationSettings(),
			now: STAMP,
		})
		const prepared = prepareRestoredAppState(payload)
		expect(prepared.profiles).toHaveLength(2)
		expect(prepared.activeProfileId).toBe(me.id)
		expect(prepared.salarySettings?.profileId).toBe(me.id)
	})
})
