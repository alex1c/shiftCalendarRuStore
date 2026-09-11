/**
 * Local persistence for schedule profiles, overrides, salary and
 * notification settings.
 *
 * AsyncStorage is used on purpose: one JSON document per key, a clean
 * repository API, and no native SQLite prepare/finalize races. The UI talks
 * only to this module, so a later SQLite migration will not rewrite screens.
 *
 * Reads and writes are sequential — never fan out concurrent native calls
 * against the same store with Promise.all.
 *
 * Schema v3 stores profiles at `@shiftcalendar/profiles`. Legacy v1/v2
 * single-schedule documents are migrated into a primary profile named `Я`.
 * Reminder settings live at `@shiftcalendar/notifications` and survive a
 * schedule reset, same as salary.
 */

import AsyncStorage from '@react-native-async-storage/async-storage'

import {
	DEFAULT_PRIMARY_PROFILE_NAME,
	NOTIFICATION_SETTINGS_SCHEMA_VERSION,
	PROFILES_DOCUMENT_VERSION,
	SALARY_SCHEMA_VERSION,
	buildScheduleProfile,
	emptyOverrideMap,
	findPrimaryProfile,
	isDayOverride,
	isNotificationSettings,
	isSalarySettings,
	isScheduleProfile,
	isWorkSchedule,
	normalizeNotificationSettings,
	normalizeScheduleProfile,
	replaceProfile,
	resolveActiveProfile,
	updateProfileOverrides,
	updateProfileSchedule,
	type NotificationSettings,
	type RestoredAppState,
	type SalarySettings,
	type ScheduleProfile,
} from '@/src/domain'
import type { DayOverride, DayOverrideMap, WorkSchedule } from '@/src/types'
import { STORAGE_KEYS, STORAGE_SCHEMA_VERSION } from './keys'

type MetaState = {
	schemaVersion: number
}

type StoredOverrides = {
	byDate: DayOverrideMap
}

type StoredProfiles = {
	schemaVersion: number
	profiles: ScheduleProfile[]
}

type StoredActiveProfile = {
	id: string
}

type StoredSalary = {
	schemaVersion: number
	settings: SalarySettings
}

type StoredNotifications = {
	schemaVersion: number
	settings: NotificationSettings
}

let migrated = false

/** Test helper — allow re-running migration logic. */
export function resetStorageMigrationFlagForTests (): void {
	migrated = false
}

async function readJson<T> (key: string): Promise<T | null> {
	try {
		const raw = await AsyncStorage.getItem(key)
		if (raw == null) {
			return null
		}
		return JSON.parse(raw) as T
	} catch {
		return null
	}
}

async function writeJson (key: string, value: unknown): Promise<void> {
	await AsyncStorage.setItem(key, JSON.stringify(value))
}

function normalizeOverride (value: DayOverride): DayOverride {
	return {
		id: value.id,
		date: value.date,
		type: value.type,
		shiftTypeId: value.shiftTypeId ?? null,
		startTime: value.startTime ?? null,
		endTime: value.endTime ?? null,
		breakMinutes: Number(value.breakMinutes) || 0,
		overtimeMinutes: Number(value.overtimeMinutes) || 0,
		customName: value.customName ?? null,
		customShortName: value.customShortName ?? null,
		isWork: value.isWork ?? null,
		note: value.note ?? null,
		createdAt: value.createdAt,
		updatedAt: value.updatedAt,
	}
}

function parseOverrideMap (value: unknown): DayOverrideMap {
	if (!value || typeof value !== 'object') {
		return emptyOverrideMap()
	}
	const record = value as Partial<StoredOverrides> & DayOverrideMap
	const source =
		record.byDate && typeof record.byDate === 'object'
			? record.byDate
			: (record as DayOverrideMap)
	const next: DayOverrideMap = {}
	for (const [date, item] of Object.entries(source)) {
		if (isDayOverride(item) && item.date === date) {
			next[date] = normalizeOverride(item)
		}
	}
	return next
}

function parseProfiles (value: unknown): ScheduleProfile[] {
	if (!value || typeof value !== 'object') {
		return []
	}
	const record = value as Partial<StoredProfiles>
	if (!Array.isArray(record.profiles)) {
		return []
	}
	const next: ScheduleProfile[] = []
	for (const item of record.profiles) {
		if (isScheduleProfile(item)) {
			next.push(normalizeScheduleProfile({
				...item,
				overrides: parseOverrideMap(item.overrides),
			}))
		}
	}
	if (next.length === 0) {
		return []
	}
	if (!next.some((item) => item.isPrimary)) {
		next[0] = { ...next[0]!, isPrimary: true }
	}
	return next
}

function parseSalarySettings (value: unknown): SalarySettings | null {
	if (!value || typeof value !== 'object') {
		return null
	}
	const record = value as Partial<StoredSalary> & Partial<SalarySettings>
	const nested = record.settings
	const candidate = isSalarySettings(nested)
		? nested
		: isSalarySettings(record)
			? record
			: null
	if (!candidate) {
		return null
	}
	if (
		typeof record.schemaVersion === 'number' &&
		record.schemaVersion > SALARY_SCHEMA_VERSION
	) {
		return candidate
	}
	return candidate
}

function parseNotificationSettings (
	value: unknown,
): NotificationSettings | null {
	if (!value || typeof value !== 'object') {
		return null
	}
	const record = value as Partial<StoredNotifications> &
		Partial<NotificationSettings>
	const nested = record.settings
	const candidate = isNotificationSettings(nested)
		? nested
		: isNotificationSettings(record)
			? record
			: null
	if (!candidate) {
		return null
	}
	return normalizeNotificationSettings(candidate)
}

async function writeProfiles (profiles: ScheduleProfile[]): Promise<void> {
	const payload: StoredProfiles = {
		schemaVersion: PROFILES_DOCUMENT_VERSION,
		profiles,
	}
	await writeJson(STORAGE_KEYS.profiles, payload)
}

async function writeActiveProfileId (id: string | null): Promise<void> {
	if (!id) {
		await AsyncStorage.removeItem(STORAGE_KEYS.activeProfile)
		return
	}
	const payload: StoredActiveProfile = { id }
	await writeJson(STORAGE_KEYS.activeProfile, payload)
}

async function readActiveProfileId (): Promise<string | null> {
	const stored = await readJson<unknown>(STORAGE_KEYS.activeProfile)
	if (!stored || typeof stored !== 'object') {
		return null
	}
	const record = stored as Partial<StoredActiveProfile>
	return typeof record.id === 'string' ? record.id : null
}

async function bindSalaryToPrimary (
	primaryId: string,
): Promise<void> {
	const stored = await readJson<unknown>(STORAGE_KEYS.salary)
	const settings = parseSalarySettings(stored)
	if (!settings) {
		return
	}
	if (settings.profileId === primaryId) {
		return
	}
	const payload: StoredSalary = {
		schemaVersion: SALARY_SCHEMA_VERSION,
		settings: { ...settings, profileId: primaryId },
	}
	await writeJson(STORAGE_KEYS.salary, payload)
}

/**
 * Copy a v1/v2 single schedule (+ overrides) into a primary profile `Я`.
 * No-op when a valid profiles document already exists.
 */
async function migrateLegacyToProfiles (): Promise<void> {
	const existing = parseProfiles(
		await readJson<unknown>(STORAGE_KEYS.profiles),
	)
	if (existing.length > 0) {
		const primary = findPrimaryProfile(existing)
		if (primary) {
			await bindSalaryToPrimary(primary.id)
		}
		return
	}
	const legacySchedule = await readJson<unknown>(STORAGE_KEYS.schedule)
	if (!isWorkSchedule(legacySchedule)) {
		return
	}
	const legacyOverrides = parseOverrideMap(
		await readJson<unknown>(STORAGE_KEYS.overrides),
	)
	const profile = buildScheduleProfile({
		name: DEFAULT_PRIMARY_PROFILE_NAME,
		schedule: legacySchedule,
		overrides: legacyOverrides,
		accent: 'blue',
		isPrimary: true,
	})
	await writeProfiles([profile])
	await writeActiveProfileId(profile.id)
	await bindSalaryToPrimary(profile.id)
	await AsyncStorage.removeItem(STORAGE_KEYS.schedule)
	await AsyncStorage.removeItem(STORAGE_KEYS.overrides)
}

/**
 * Ensure schema meta exists and legacy single-schedule data is migrated.
 */
export async function ensureStorageMigrated (): Promise<void> {
	if (migrated) {
		return
	}
	const meta = await readJson<MetaState>(STORAGE_KEYS.meta)
	if (
		Number.isInteger(meta?.schemaVersion) &&
		meta!.schemaVersion > STORAGE_SCHEMA_VERSION
	) {
		migrated = true
		return
	}
	await migrateLegacyToProfiles()
	await writeJson(STORAGE_KEYS.meta, {
		schemaVersion: STORAGE_SCHEMA_VERSION,
	})
	migrated = true
}

export async function getProfiles (): Promise<ScheduleProfile[]> {
	await ensureStorageMigrated()
	return parseProfiles(await readJson<unknown>(STORAGE_KEYS.profiles))
}

export async function saveProfiles (
	profiles: ScheduleProfile[],
): Promise<void> {
	await ensureStorageMigrated()
	await writeProfiles(profiles)
}

export async function getActiveProfileId (): Promise<string | null> {
	await ensureStorageMigrated()
	const profiles = await getProfiles()
	const storedId = await readActiveProfileId()
	const active = resolveActiveProfile(profiles, storedId)
	return active?.id ?? null
}

export async function saveActiveProfileId (
	id: string,
): Promise<void> {
	await ensureStorageMigrated()
	await writeActiveProfileId(id)
}

async function activeProfile (): Promise<ScheduleProfile | null> {
	const profiles = await getProfiles()
	const storedId = await readActiveProfileId()
	return resolveActiveProfile(profiles, storedId)
}

/**
 * Load the active schedule, or null when the user still needs onboarding.
 */
export async function getWorkSchedule (): Promise<WorkSchedule | null> {
	const profile = await activeProfile()
	return profile?.schedule ?? null
}

/**
 * Persist the active schedule. Creates a primary `Я` profile on first save.
 */
export async function saveWorkSchedule (
	schedule: WorkSchedule,
): Promise<void> {
	await ensureStorageMigrated()
	const profiles = await getProfiles()
	if (profiles.length === 0) {
		const leftover = parseOverrideMap(
			await readJson<unknown>(STORAGE_KEYS.overrides),
		)
		const profile = buildScheduleProfile({
			name: DEFAULT_PRIMARY_PROFILE_NAME,
			schedule,
			overrides: leftover,
			accent: 'blue',
			isPrimary: true,
		})
		await writeProfiles([profile])
		await writeActiveProfileId(profile.id)
		await bindSalaryToPrimary(profile.id)
		await AsyncStorage.removeItem(STORAGE_KEYS.overrides)
		return
	}
	const storedId = await readActiveProfileId()
	const current = resolveActiveProfile(profiles, storedId)
	if (!current) {
		return
	}
	await writeProfiles(
		replaceProfile(profiles, updateProfileSchedule(current, schedule)),
	)
}

/**
 * Remove every profile so onboarding can run.
 * Salary settings are kept: the rate usually survives a schedule reset.
 */
export async function clearWorkSchedule (): Promise<void> {
	await ensureStorageMigrated()
	await AsyncStorage.removeItem(STORAGE_KEYS.schedule)
	await AsyncStorage.removeItem(STORAGE_KEYS.overrides)
	await AsyncStorage.removeItem(STORAGE_KEYS.profiles)
	await AsyncStorage.removeItem(STORAGE_KEYS.activeProfile)
}

/** Load salary settings. Missing or corrupt JSON is treated as unset. */
export async function getSalarySettings (): Promise<SalarySettings | null> {
	await ensureStorageMigrated()
	const stored = await readJson<unknown>(STORAGE_KEYS.salary)
	return parseSalarySettings(stored)
}

/** Persist versioned salary settings (separate from the schedule document). */
export async function saveSalarySettings (
	settings: SalarySettings,
): Promise<void> {
	await ensureStorageMigrated()
	const payload: StoredSalary = {
		schemaVersion: SALARY_SCHEMA_VERSION,
		settings,
	}
	await writeJson(STORAGE_KEYS.salary, payload)
}

/** User-initiated wipe of payment settings only. */
export async function clearSalarySettings (): Promise<void> {
	await ensureStorageMigrated()
	await AsyncStorage.removeItem(STORAGE_KEYS.salary)
}

/** Load shift-reminder settings. Missing or corrupt JSON is unset. */
export async function getNotificationSettings (): Promise<NotificationSettings | null> {
	await ensureStorageMigrated()
	const stored = await readJson<unknown>(STORAGE_KEYS.notifications)
	return parseNotificationSettings(stored)
}

/** Persist versioned reminder settings (independent of the schedule). */
export async function saveNotificationSettings (
	settings: NotificationSettings,
): Promise<void> {
	await ensureStorageMigrated()
	const payload: StoredNotifications = {
		schemaVersion: NOTIFICATION_SETTINGS_SCHEMA_VERSION,
		settings: normalizeNotificationSettings(settings),
	}
	await writeJson(STORAGE_KEYS.notifications, payload)
}

/** User-initiated wipe of reminder settings only. */
export async function clearNotificationSettings (): Promise<void> {
	await ensureStorageMigrated()
	await AsyncStorage.removeItem(STORAGE_KEYS.notifications)
}

/**
 * Atomic full-app replace used by backup restore.
 * Validates/prepares state elsewhere; this only serializes and multiSets
 * so we never clear first and leave a half-empty store.
 */
export async function replaceAppDataFromBackup (
	state: RestoredAppState,
): Promise<void> {
	const profilesPayload: StoredProfiles = {
		schemaVersion: PROFILES_DOCUMENT_VERSION,
		profiles: state.profiles,
	}
	const activePayload: StoredActiveProfile = {
		id: state.activeProfileId,
	}
	const pairs: [string, string][] = [
		[
			STORAGE_KEYS.meta,
			JSON.stringify({ schemaVersion: STORAGE_SCHEMA_VERSION }),
		],
		[STORAGE_KEYS.profiles, JSON.stringify(profilesPayload)],
		[STORAGE_KEYS.activeProfile, JSON.stringify(activePayload)],
	]
	if (state.salarySettings) {
		const salaryPayload: StoredSalary = {
			schemaVersion: SALARY_SCHEMA_VERSION,
			settings: state.salarySettings,
		}
		pairs.push([STORAGE_KEYS.salary, JSON.stringify(salaryPayload)])
	}
	if (state.notificationSettings) {
		const notificationsPayload: StoredNotifications = {
			schemaVersion: NOTIFICATION_SETTINGS_SCHEMA_VERSION,
			settings: normalizeNotificationSettings(state.notificationSettings),
		}
		pairs.push([
			STORAGE_KEYS.notifications,
			JSON.stringify(notificationsPayload),
		])
	}

	await AsyncStorage.multiSet(pairs)

	const removals: string[] = [
		STORAGE_KEYS.schedule,
		STORAGE_KEYS.overrides,
	]
	if (!state.salarySettings) {
		removals.push(STORAGE_KEYS.salary)
	}
	if (!state.notificationSettings) {
		removals.push(STORAGE_KEYS.notifications)
	}
	await AsyncStorage.multiRemove(removals)
	migrated = true
}

/** Load date-keyed day overrides for the active profile. */
export async function getDayOverrides (): Promise<DayOverrideMap> {
	const profile = await activeProfile()
	if (profile) {
		return profile.overrides
	}
	await ensureStorageMigrated()
	const stored = await readJson<unknown>(STORAGE_KEYS.overrides)
	return parseOverrideMap(stored)
}

/** Persist the full override map for the active profile. */
export async function saveDayOverrides (
	overrides: DayOverrideMap,
): Promise<void> {
	await ensureStorageMigrated()
	const profiles = await getProfiles()
	if (profiles.length === 0) {
		await writeJson(STORAGE_KEYS.overrides, { byDate: overrides })
		return
	}
	const storedId = await readActiveProfileId()
	const current = resolveActiveProfile(profiles, storedId)
	if (!current) {
		return
	}
	await writeProfiles(
		replaceProfile(profiles, updateProfileOverrides(current, overrides)),
	)
}

/** Test helper — wipe calendar, profile and salary keys. */
export async function clearAllStorageForTests (): Promise<void> {
	await AsyncStorage.multiRemove([
		STORAGE_KEYS.meta,
		STORAGE_KEYS.schedule,
		STORAGE_KEYS.overrides,
		STORAGE_KEYS.salary,
		STORAGE_KEYS.notifications,
		STORAGE_KEYS.profiles,
		STORAGE_KEYS.activeProfile,
	])
	migrated = false
}

export { STORAGE_KEYS, STORAGE_SCHEMA_VERSION } from './keys'
