/**
 * Versioned app backup — pure domain, no file I/O or AsyncStorage.
 *
 * backupVersion is independent from STORAGE_SCHEMA_VERSION. Future
 * restore paths migrate through `migrateBackup` before validation.
 */

import {
	calendarDateFromDate,
	formatCalendarDate,
} from './dates'
import { formatDayMonthYear } from './format'
import {
	isNotificationSettings,
	normalizeNotificationSettings,
	type NotificationSettings,
} from './notifications'
import {
	findPrimaryProfile,
	isScheduleProfile,
	normalizeScheduleProfile,
	resolveActiveProfile,
	type ScheduleProfile,
} from './profiles'
import {
	isSalarySettings,
	type SalarySettings,
} from './salary'

export const BACKUP_VERSION = 1
export const BACKUP_APP_ID = 'com.calculatorplatform.shiftcalendar'
export const BACKUP_APP_LABEL = 'Мой график смен'

export type BackupData = {
	profiles: ScheduleProfile[]
	activeProfileId: string | null
	salarySettings: SalarySettings | null
	notificationSettings: NotificationSettings | null
}

export type BackupPayload = {
	app: string
	backupVersion: number
	createdAt: string
	data: BackupData
}

/** Normalized state ready for an atomic storage write. */
export type RestoredAppState = {
	profiles: ScheduleProfile[]
	activeProfileId: string
	salarySettings: SalarySettings | null
	notificationSettings: NotificationSettings | null
}

export type BackupPreview = {
	createdAtLabel: string
	profileCount: number
	primaryName: string
	salaryLabel: string
	notificationsLabel: string
	activeName: string | null
}

export type BackupErrorCode =
	| 'not_backup'
	| 'unsupported_version'
	| 'corrupt'
	| 'restore_failed'

export type BackupResult<T> =
	| { ok: true; value: T }
	| { ok: false; code: BackupErrorCode; message: string }

export const BACKUP_ERROR_MESSAGES: Record<BackupErrorCode, string> = {
	not_backup: 'Файл не является резервной копией приложения',
	unsupported_version: 'Версия резервной копии не поддерживается',
	corrupt: 'Файл повреждён',
	restore_failed: 'Не удалось восстановить данные',
}

function fail (
	code: BackupErrorCode,
	message: string = BACKUP_ERROR_MESSAGES[code],
): BackupResult<never> {
	return { ok: false, code, message }
}

function pad2 (value: number): string {
	return String(value).padStart(2, '0')
}

/**
 * Filename without Cyrillic for share/filesystem compatibility.
 * Example: `Moi_grafik_smen_backup_2026-09-11_14-30.json`
 */
export function buildBackupFileName (now: Date = new Date()): string {
	const date = formatCalendarDate(
		now.getFullYear(),
		now.getMonth() + 1,
		now.getDate(),
	)
	const time = `${pad2(now.getHours())}-${pad2(now.getMinutes())}`
	return `Moi_grafik_smen_backup_${date}_${time}.json`
}

export type BuildBackupPayloadInput = {
	profiles: readonly ScheduleProfile[]
	activeProfileId: string | null
	salarySettings: SalarySettings | null
	notificationSettings: NotificationSettings | null
	now?: Date
}

/** Build a versioned backup document from in-memory app state. */
export function buildBackupPayload (
	input: BuildBackupPayloadInput,
): BackupPayload {
	const now = input.now ?? new Date()
	const profiles = input.profiles.map((item) =>
		normalizeScheduleProfile(item),
	)
	const primary = findPrimaryProfile(profiles)
	const active = resolveActiveProfile(profiles, input.activeProfileId)
	let salary = input.salarySettings
	if (salary && primary) {
		salary = {
			...salary,
			profileId: salary.profileId ?? primary.id,
		}
	}
	return {
		app: BACKUP_APP_ID,
		backupVersion: BACKUP_VERSION,
		createdAt: now.toISOString(),
		data: {
			profiles,
			activeProfileId: active?.id ?? primary?.id ?? null,
			salarySettings: salary,
			notificationSettings: input.notificationSettings
				? normalizeNotificationSettings(input.notificationSettings)
				: null,
		},
	}
}

/**
 * Migrate any supported backup document to the current backupVersion.
 * v1 is currently a no-op identity pass.
 */
export function migrateBackup (input: unknown): BackupResult<unknown> {
	if (input == null || typeof input !== 'object') {
		return fail('not_backup')
	}
	const record = input as { backupVersion?: unknown; app?: unknown }
	if (typeof record.backupVersion !== 'number') {
		return fail('corrupt')
	}
	if (!Number.isInteger(record.backupVersion)) {
		return fail('corrupt')
	}
	if (record.backupVersion > BACKUP_VERSION) {
		return fail('unsupported_version')
	}
	if (record.backupVersion < 1) {
		return fail('unsupported_version')
	}
	// Future: if (record.backupVersion === 1) { …upgrade… }
	return { ok: true, value: input }
}

function parseNullableSalary (
	value: unknown,
): BackupResult<SalarySettings | null> {
	if (value == null) {
		return { ok: true, value: null }
	}
	if (!isSalarySettings(value)) {
		return fail('corrupt')
	}
	return { ok: true, value }
}

function parseNullableNotifications (
	value: unknown,
): BackupResult<NotificationSettings | null> {
	if (value == null) {
		return { ok: true, value: null }
	}
	if (!isNotificationSettings(value)) {
		return fail('corrupt')
	}
	return {
		ok: true,
		value: normalizeNotificationSettings(value),
	}
}

/**
 * Validate a migrated backup. Rejects empty profiles and structurally
 * invalid salary/notification documents. Does not write storage.
 */
export function validateBackup (
	input: unknown,
): BackupResult<BackupPayload> {
	if (input == null || typeof input !== 'object') {
		return fail('not_backup')
	}
	const record = input as Partial<BackupPayload> & {
		data?: Partial<BackupData>
	}
	if (record.app !== BACKUP_APP_ID) {
		return fail('not_backup')
	}
	if (record.backupVersion !== BACKUP_VERSION) {
		// migrateBackup should already have rejected future versions;
		// anything else here is corrupt / incomplete migration.
		if (
			typeof record.backupVersion === 'number' &&
			record.backupVersion > BACKUP_VERSION
		) {
			return fail('unsupported_version')
		}
		return fail('corrupt')
	}
	if (typeof record.createdAt !== 'string' || record.createdAt.length === 0) {
		return fail('corrupt')
	}
	if (!record.data || typeof record.data !== 'object') {
		return fail('corrupt')
	}
	if (!Array.isArray(record.data.profiles) || record.data.profiles.length === 0) {
		return fail('corrupt')
	}

	const profiles: ScheduleProfile[] = []
	for (const item of record.data.profiles) {
		if (!isScheduleProfile(item)) {
			return fail('corrupt')
		}
		profiles.push(normalizeScheduleProfile(item))
	}

	const primaryMarked = profiles.filter((item) => item.isPrimary)
	if (primaryMarked.length === 0) {
		// Explicit repair rule: promote the first profile when none is primary.
		profiles[0] = { ...profiles[0]!, isPrimary: true }
	} else if (primaryMarked.length > 1) {
		// Keep the first primary; demote the rest.
		let kept = false
		for (let index = 0; index < profiles.length; index += 1) {
			const item = profiles[index]!
			if (!item.isPrimary) {
				continue
			}
			if (!kept) {
				kept = true
				continue
			}
			profiles[index] = { ...item, isPrimary: false }
		}
	}

	const primary = findPrimaryProfile(profiles)
	if (!primary) {
		return fail('corrupt')
	}

	const rawActive = record.data.activeProfileId
	if (
		rawActive !== null &&
		rawActive !== undefined &&
		typeof rawActive !== 'string'
	) {
		return fail('corrupt')
	}
	const active = resolveActiveProfile(
		profiles,
		typeof rawActive === 'string' ? rawActive : null,
	)

	const salaryResult = parseNullableSalary(record.data.salarySettings)
	if (!salaryResult.ok) {
		return salaryResult
	}
	const notificationsResult = parseNullableNotifications(
		record.data.notificationSettings,
	)
	if (!notificationsResult.ok) {
		return notificationsResult
	}

	return {
		ok: true,
		value: {
			app: BACKUP_APP_ID,
			backupVersion: BACKUP_VERSION,
			createdAt: record.createdAt,
			data: {
				profiles,
				activeProfileId: active?.id ?? primary.id,
				salarySettings: salaryResult.value,
				notificationSettings: notificationsResult.value,
			},
		},
	}
}

/**
 * Parse raw JSON text into a validated backup. Empty / broken JSON maps
 * to the user-facing corrupt / not_backup messages.
 */
export function parseBackupJson (raw: string): BackupResult<BackupPayload> {
	// Some Android document providers preserve a UTF-8 BOM on import.
	const trimmed = raw.replace(/^\uFEFF/, '').trim()
	if (trimmed.length === 0) {
		return fail('corrupt')
	}
	let parsed: unknown
	try {
		parsed = JSON.parse(trimmed) as unknown
	} catch {
		return fail('corrupt')
	}
	const migrated = migrateBackup(parsed)
	if (!migrated.ok) {
		return migrated
	}
	return validateBackup(migrated.value)
}

/**
 * Prepare the atomic restore snapshot: bind salary to primary and fall
 * back activeProfileId when the stored id is missing.
 */
export function prepareRestoredAppState (
	backup: BackupPayload,
): RestoredAppState {
	const profiles = backup.data.profiles.map((item) =>
		normalizeScheduleProfile(item),
	)
	const primary = findPrimaryProfile(profiles)!
	const active = resolveActiveProfile(
		profiles,
		backup.data.activeProfileId,
	)
	let salary = backup.data.salarySettings
	if (salary) {
		const boundId =
			salary.profileId &&
			profiles.some((item) => item.id === salary!.profileId)
				? salary.profileId
				: primary.id
		salary = { ...salary, profileId: boundId }
	}
	return {
		profiles,
		activeProfileId: active?.id ?? primary.id,
		salarySettings: salary,
		notificationSettings: backup.data.notificationSettings
			? normalizeNotificationSettings(backup.data.notificationSettings)
			: null,
	}
}

/** Full pure restore pipeline: migrate → validate → prepare. */
export function restoreBackup (
	input: unknown,
): BackupResult<RestoredAppState> {
	const migrated = migrateBackup(input)
	if (!migrated.ok) {
		return migrated
	}
	const validated = validateBackup(migrated.value)
	if (!validated.ok) {
		return validated
	}
	return {
		ok: true,
		value: prepareRestoredAppState(validated.value),
	}
}

export function buildBackupPreview (
	backup: BackupPayload,
): BackupPreview {
	const primary = findPrimaryProfile(backup.data.profiles)
	const active = resolveActiveProfile(
		backup.data.profiles,
		backup.data.activeProfileId,
	)
	const salary = backup.data.salarySettings
	const notifications = backup.data.notificationSettings
	let createdAtLabel = backup.createdAt
	try {
		const created = new Date(backup.createdAt)
		if (!Number.isNaN(created.getTime())) {
			createdAtLabel = formatDayMonthYear(calendarDateFromDate(created))
		}
	} catch {
		// Keep ISO fallback.
	}
	return {
		createdAtLabel,
		profileCount: backup.data.profiles.length,
		primaryName: primary?.name ?? '—',
		activeName: active?.name ?? null,
		salaryLabel: salary?.enabled ? 'настроена' : 'не настроена',
		notificationsLabel: notifications?.enabled
			? 'включены'
			: 'выключены',
	}
}

/** Serialize a backup for export (pretty-printed for readability). */
export function serializeBackupPayload (payload: BackupPayload): string {
	return `${JSON.stringify(payload, null, 2)}\n`
}
