/**
 * Native adapter for backup file create / share / import.
 * Domain code must not import expo-file-system here — only this module.
 */

import * as DocumentPicker from 'expo-document-picker'
import { File, Paths } from 'expo-file-system'
import * as Sharing from 'expo-sharing'

import {
	BACKUP_ERROR_MESSAGES,
	buildBackupFileName,
	parseBackupJson,
	serializeBackupPayload,
	type BackupPayload,
	type BackupResult,
} from '@/src/domain'

export type ExportedBackupFile = {
	uri: string
	fileName: string
}

/**
 * Write the backup JSON into the cache directory and return its URI.
 */
export async function writeBackupFile (
	payload: BackupPayload,
	now: Date = new Date(),
): Promise<ExportedBackupFile> {
	const fileName = buildBackupFileName(now)
	const file = new File(Paths.cache, fileName)
	file.create({ overwrite: true })
	file.write(serializeBackupPayload(payload))
	return { uri: file.uri, fileName }
}

/**
 * Share a previously written backup via the system share sheet when
 * available. Falls back to a no-op success when sharing is unavailable
 * (the file still exists in cache for the user to access on some builds).
 */
export async function shareBackupFile (
	uri: string,
	fileName: string,
): Promise<void> {
	const available = await Sharing.isAvailableAsync()
	if (!available) {
		return
	}
	await Sharing.shareAsync(uri, {
		mimeType: 'application/json',
		dialogTitle: fileName,
		UTI: 'public.json',
	})
}

/** Create the backup file and open the share sheet. */
export async function exportAndShareBackup (
	payload: BackupPayload,
	now: Date = new Date(),
): Promise<ExportedBackupFile> {
	const exported = await writeBackupFile(payload, now)
	await shareBackupFile(exported.uri, exported.fileName)
	return exported
}

/**
 * Open the document picker for a JSON backup. Returns null when the user
 * cancels. Validates the file contents before returning.
 */
export async function pickAndParseBackup (): Promise<BackupResult<BackupPayload> | null> {
	const result = await DocumentPicker.getDocumentAsync({
		type: ['application/json', 'text/json', 'text/plain'],
		copyToCacheDirectory: true,
		multiple: false,
	})
	if (result.canceled || !result.assets?.[0]) {
		return null
	}
	const asset = result.assets[0]
	const name = asset.name?.toLowerCase() ?? ''
	const mime = asset.mimeType?.toLowerCase() ?? ''
	const looksJson =
		name.endsWith('.json') ||
		mime.includes('json') ||
		mime === 'text/plain' ||
		mime.length === 0
	if (!looksJson) {
		return {
			ok: false,
			code: 'not_backup',
			message: BACKUP_ERROR_MESSAGES.not_backup,
		}
	}
	try {
		const file = new File(asset.uri)
		const raw = await file.text()
		return parseBackupJson(raw)
	} catch {
		return {
			ok: false,
			code: 'corrupt',
			message: BACKUP_ERROR_MESSAGES.corrupt,
		}
	}
}
