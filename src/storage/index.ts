/**
 * Local persistence for the active work schedule and day overrides.
 *
 * AsyncStorage is used on purpose: one JSON document per key, a clean
 * repository API, and no native SQLite prepare/finalize races. The UI talks
 * only to this module, so a later SQLite migration will not rewrite screens.
 *
 * Reads and writes are sequential — never fan out concurrent native calls
 * against the same store with Promise.all.
 */

import AsyncStorage from '@react-native-async-storage/async-storage'

import {
	emptyOverrideMap,
	isDayOverride,
	isSalarySettings,
	SALARY_SCHEMA_VERSION,
	type SalarySettings,
} from '@/src/domain'
import type { DayOverride, DayOverrideMap, WorkSchedule } from '@/src/types'
import { STORAGE_KEYS, STORAGE_SCHEMA_VERSION } from './keys'

type MetaState = {
	schemaVersion: number
}

type StoredOverrides = {
	byDate: DayOverrideMap
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

/**
 * Ensure schema meta exists. Safe to call repeatedly.
 * v1 → v2 only bumps the version; the schedule document is unchanged
 * and missing overrides are treated as an empty map.
 */
export async function ensureStorageMigrated (): Promise<void> {
	if (migrated) {
		return
	}
	const meta = await readJson<MetaState>(STORAGE_KEYS.meta)
	if (meta?.schemaVersion === STORAGE_SCHEMA_VERSION) {
		migrated = true
		return
	}
	if (
		Number.isInteger(meta?.schemaVersion) &&
		meta!.schemaVersion > STORAGE_SCHEMA_VERSION
	) {
		migrated = true
		return
	}
	await writeJson(STORAGE_KEYS.meta, {
		schemaVersion: STORAGE_SCHEMA_VERSION,
	})
	migrated = true
}

function isWorkSchedule (value: unknown): value is WorkSchedule {
	if (!value || typeof value !== 'object') {
		return false
	}
	const record = value as Partial<WorkSchedule>
	return (
		typeof record.id === 'string' &&
		typeof record.name === 'string' &&
		typeof record.presetId === 'string' &&
		typeof record.startDate === 'string' &&
		Array.isArray(record.cycle) &&
		record.cycle.length > 0 &&
		Array.isArray(record.shiftTypes) &&
		record.shiftTypes.length > 0
	)
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

/**
 * Load the active schedule, or null when the user still needs onboarding.
 */
export async function getWorkSchedule (): Promise<WorkSchedule | null> {
	await ensureStorageMigrated()
	const stored = await readJson<unknown>(STORAGE_KEYS.schedule)
	if (!isWorkSchedule(stored)) {
		return null
	}
	return stored
}

/**
 * Persist the active schedule (overwrites the previous one).
 */
export async function saveWorkSchedule (
	schedule: WorkSchedule,
): Promise<void> {
	await ensureStorageMigrated()
	await writeJson(STORAGE_KEYS.schedule, schedule)
}

/**
 * Remove the saved schedule and its day overrides so onboarding can run.
 * Salary settings are kept: the rate usually survives a schedule reset.
 */
export async function clearWorkSchedule (): Promise<void> {
	await ensureStorageMigrated()
	await AsyncStorage.removeItem(STORAGE_KEYS.schedule)
	await AsyncStorage.removeItem(STORAGE_KEYS.overrides)
}

type StoredSalary = {
	schemaVersion: number
	settings: SalarySettings
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

/** Load date-keyed day overrides. Missing or corrupt data is an empty map. */
export async function getDayOverrides (): Promise<DayOverrideMap> {
	await ensureStorageMigrated()
	const stored = await readJson<unknown>(STORAGE_KEYS.overrides)
	return parseOverrideMap(stored)
}

/** Persist the full override map (one document, keyed by date). */
export async function saveDayOverrides (
	overrides: DayOverrideMap,
): Promise<void> {
	await ensureStorageMigrated()
	await writeJson(STORAGE_KEYS.overrides, { byDate: overrides })
}

/** Test helper — wipe calendar and salary keys. */
export async function clearAllStorageForTests (): Promise<void> {
	await AsyncStorage.multiRemove([
		STORAGE_KEYS.meta,
		STORAGE_KEYS.schedule,
		STORAGE_KEYS.overrides,
		STORAGE_KEYS.salary,
	])
	migrated = false
}

export { STORAGE_KEYS, STORAGE_SCHEMA_VERSION } from './keys'
