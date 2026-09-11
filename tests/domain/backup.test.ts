/**
 * Pure backup build / validate / migrate / restore tests.
 */

import {
	BACKUP_APP_ID,
	BACKUP_VERSION,
	buildBackupFileName,
	buildBackupPayload,
	buildBackupPreview,
	buildDayOverride,
	buildScheduleProfile,
	createWorkScheduleFromPreset,
	defaultNotificationSettings,
	defaultSalarySettings,
	migrateBackup,
	parseBackupJson,
	prepareRestoredAppState,
	requireSchedulePreset,
	restoreBackup,
	serializeBackupPayload,
	upsertOverride,
	validateBackup,
	validateDayOverride,
	type DayOverride,
	type DayOverrideInput,
} from '@/src/domain'

const STAMP = new Date('2026-09-11T12:00:00.000Z')

function twoTwo (startDate = '2026-09-01') {
	return createWorkScheduleFromPreset({
		preset: requireSchedulePreset('2-2'),
		startDate,
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

function primaryProfile () {
	return buildScheduleProfile({
		name: 'Я',
		schedule: twoTwo(),
		accent: 'blue',
		isPrimary: true,
		now: STAMP,
		overrides: upsertOverride(
			{},
			overrideFrom({
				date: '2026-09-12',
				type: 'vacation',
				note: 'Семейный отпуск',
			}),
		),
	})
}

describe('buildBackupPayload', () => {
	it('builds a single-profile backup', () => {
		const me = primaryProfile()
		const payload = buildBackupPayload({
			profiles: [me],
			activeProfileId: me.id,
			salarySettings: null,
			notificationSettings: null,
			now: STAMP,
		})
		expect(payload.app).toBe(BACKUP_APP_ID)
		expect(payload.backupVersion).toBe(BACKUP_VERSION)
		expect(payload.data.profiles).toHaveLength(1)
		expect(payload.data.profiles[0]?.id).toBe(me.id)
		expect(payload.data.profiles[0]?.overrides['2026-09-12']?.note).toBe(
			'Семейный отпуск',
		)
		expect(payload.data.activeProfileId).toBe(me.id)
	})

	it('keeps multi-profile overrides isolated', () => {
		const me = primaryProfile()
		const wife = buildScheduleProfile({
			name: 'Жена',
			schedule: twoTwo('2026-09-02'),
			accent: 'green',
			isPrimary: false,
			now: STAMP,
			overrides: upsertOverride(
				{},
				overrideFrom({ date: '2026-09-13', type: 'sick' }),
			),
		})
		const payload = buildBackupPayload({
			profiles: [me, wife],
			activeProfileId: wife.id,
			salarySettings: null,
			notificationSettings: null,
			now: STAMP,
		})
		expect(payload.data.profiles).toHaveLength(2)
		expect(payload.data.profiles[0]?.overrides['2026-09-12']?.type).toBe(
			'vacation',
		)
		expect(payload.data.profiles[1]?.overrides['2026-09-13']?.type).toBe(
			'sick',
		)
		expect(payload.data.profiles[0]?.overrides['2026-09-13']).toBeUndefined()
		expect(payload.data.activeProfileId).toBe(wife.id)
	})

	it('preserves salary and notification settings', () => {
		const me = primaryProfile()
		const salary = {
			...defaultSalarySettings(STAMP),
			enabled: true,
			hourlyRateMinor: 50_000,
			profileId: me.id,
		}
		const notifications = {
			...defaultNotificationSettings(STAMP),
			enabled: true,
			offsetsMinutes: [60, 720],
		}
		const payload = buildBackupPayload({
			profiles: [me],
			activeProfileId: me.id,
			salarySettings: salary,
			notificationSettings: notifications,
			now: STAMP,
		})
		expect(payload.data.salarySettings).toEqual(salary)
		expect(payload.data.notificationSettings?.enabled).toBe(true)
		expect(payload.data.notificationSettings?.offsetsMinutes).toEqual([
			60, 720,
		])
	})
})

describe('validateBackup / migrateBackup', () => {
	it('rejects broken JSON', () => {
		const result = parseBackupJson('{not-json')
		expect(result.ok).toBe(false)
		if (!result.ok) {
			expect(result.code).toBe('corrupt')
		}
	})

	it('rejects an empty file', () => {
		const empty = parseBackupJson('')
		expect(empty.ok).toBe(false)
		if (!empty.ok) {
			expect(empty.code).toBe('corrupt')
		}
		const spaces = parseBackupJson('   ')
		expect(spaces.ok).toBe(false)
		if (!spaces.ok) {
			expect(spaces.code).toBe('corrupt')
		}
	})

	it('rejects missing backupVersion', () => {
		const result = migrateBackup({
			app: BACKUP_APP_ID,
			createdAt: STAMP.toISOString(),
			data: { profiles: [] },
		})
		expect(result.ok).toBe(false)
		if (!result.ok) {
			expect(result.code).toBe('corrupt')
		}
	})

	it('rejects unsupported future versions', () => {
		const result = migrateBackup({
			app: BACKUP_APP_ID,
			backupVersion: 99,
			createdAt: STAMP.toISOString(),
			data: {},
		})
		expect(result.ok).toBe(false)
		if (!result.ok) {
			expect(result.code).toBe('unsupported_version')
		}
	})

	it('rejects a file that is not our backup app', () => {
		const result = validateBackup({
			app: 'other.app',
			backupVersion: 1,
			createdAt: STAMP.toISOString(),
			data: { profiles: [primaryProfile()] },
		})
		expect(result.ok).toBe(false)
		if (!result.ok) {
			expect(result.code).toBe('not_backup')
		}
	})

	it('repairs missing primary by promoting the first profile', () => {
		const me = { ...primaryProfile(), isPrimary: false }
		const result = validateBackup({
			app: BACKUP_APP_ID,
			backupVersion: 1,
			createdAt: STAMP.toISOString(),
			data: {
				profiles: [me],
				activeProfileId: me.id,
				salarySettings: null,
				notificationSettings: null,
			},
		})
		expect(result.ok).toBe(true)
		if (result.ok) {
			expect(result.value.data.profiles[0]?.isPrimary).toBe(true)
		}
	})

	it('rejects empty profiles', () => {
		const result = validateBackup({
			app: BACKUP_APP_ID,
			backupVersion: 1,
			createdAt: STAMP.toISOString(),
			data: {
				profiles: [],
				activeProfileId: null,
				salarySettings: null,
				notificationSettings: null,
			},
		})
		expect(result.ok).toBe(false)
		if (!result.ok) {
			expect(result.code).toBe('corrupt')
		}
	})

	it('falls back activeProfileId to primary when invalid', () => {
		const me = primaryProfile()
		const result = restoreBackup({
			app: BACKUP_APP_ID,
			backupVersion: 1,
			createdAt: STAMP.toISOString(),
			data: {
				profiles: [me],
				activeProfileId: 'missing-id',
				salarySettings: null,
				notificationSettings: null,
			},
		})
		expect(result.ok).toBe(true)
		if (result.ok) {
			expect(result.value.activeProfileId).toBe(me.id)
		}
	})

	it('rebinds salary profileId to restored primary when invalid', () => {
		const me = primaryProfile()
		const salary = {
			...defaultSalarySettings(STAMP),
			enabled: true,
			hourlyRateMinor: 40_000,
			profileId: 'ghost-profile',
		}
		const state = prepareRestoredAppState({
			app: BACKUP_APP_ID,
			backupVersion: 1,
			createdAt: STAMP.toISOString(),
			data: {
				profiles: [me],
				activeProfileId: me.id,
				salarySettings: salary,
				notificationSettings: null,
			},
		})
		expect(state.salarySettings?.profileId).toBe(me.id)
	})
})

describe('backup preview and filename', () => {
	it('builds a readable preview', () => {
		const me = primaryProfile()
		const payload = buildBackupPayload({
			profiles: [me],
			activeProfileId: me.id,
			salarySettings: {
				...defaultSalarySettings(STAMP),
				enabled: true,
				hourlyRateMinor: 10_000,
			},
			notificationSettings: {
				...defaultNotificationSettings(STAMP),
				enabled: true,
			},
			now: STAMP,
		})
		const preview = buildBackupPreview(payload)
		expect(preview.profileCount).toBe(1)
		expect(preview.primaryName).toBe('Я')
		expect(preview.salaryLabel).toBe('настроена')
		expect(preview.notificationsLabel).toBe('включены')
		expect(preview.createdAtLabel).toContain('сентября')
	})

	it('uses ASCII-only filenames', () => {
		const name = buildBackupFileName(new Date(2026, 8, 11, 14, 5))
		expect(name).toBe('Moi_grafik_smen_backup_2026-09-11_14-05.json')
		expect(/[^\x00-\x7F]/.test(name)).toBe(false)
	})

	it('round-trips through JSON serialization', () => {
		const me = primaryProfile()
		const payload = buildBackupPayload({
			profiles: [me],
			activeProfileId: me.id,
			salarySettings: null,
			notificationSettings: null,
			now: STAMP,
		})
		const parsed = parseBackupJson(serializeBackupPayload(payload))
		expect(parsed.ok).toBe(true)
		if (parsed.ok) {
			expect(parsed.value.data.profiles[0]?.overrides['2026-09-12']?.note)
				.toBe('Семейный отпуск')
		}
	})
})
