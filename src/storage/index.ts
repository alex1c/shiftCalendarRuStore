/**
 * Local persistence for the active work schedule.
 *
 * AsyncStorage is used on purpose for Phase 1: one JSON document, a clean
 * repository API, and no native SQLite prepare/finalize races. The UI talks
 * only to this module, so a later SQLite migration will not rewrite screens.
 *
 * Reads and writes are sequential — never fan out concurrent native calls
 * against the same store with Promise.all.
 */

import AsyncStorage from '@react-native-async-storage/async-storage'

import type { WorkSchedule } from '@/src/types'
import { STORAGE_KEYS, STORAGE_SCHEMA_VERSION } from './keys'

type MetaState = {
	schemaVersion: number
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
 * Remove the saved schedule so the next launch returns to onboarding.
 */
export async function clearWorkSchedule (): Promise<void> {
	await ensureStorageMigrated()
	await AsyncStorage.removeItem(STORAGE_KEYS.schedule)
}

/** Test helper — wipe calendar keys. */
export async function clearAllStorageForTests (): Promise<void> {
	await AsyncStorage.multiRemove([
		STORAGE_KEYS.meta,
		STORAGE_KEYS.schedule,
	])
	migrated = false
}

export { STORAGE_KEYS, STORAGE_SCHEMA_VERSION } from './keys'
