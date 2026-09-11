/**
 * Orchestrates atomic restore + notification reschedule.
 * UI calls this after the user confirms a validated preview.
 */

import {
	BACKUP_ERROR_MESSAGES,
	prepareRestoredAppState,
	type BackupPayload,
	type BackupResult,
	type RestoredAppState,
} from '@/src/domain'
import { rescheduleShiftNotifications } from '@/src/notifications'
import { replaceAppDataFromBackup } from '@/src/storage'

export type ApplyBackupRestoreResult = BackupResult<RestoredAppState>

export type ApplyBackupRestoreDeps = {
	replaceAppData?: typeof replaceAppDataFromBackup
	reschedule?: typeof rescheduleShiftNotifications
}

/**
 * Write the validated backup atomically, then rebuild shift reminders
 * from the restored primary profile / notification settings.
 */
export async function applyBackupRestore (
	backup: BackupPayload,
	deps: ApplyBackupRestoreDeps = {},
): Promise<ApplyBackupRestoreResult> {
	const replace = deps.replaceAppData ?? replaceAppDataFromBackup
	const reschedule = deps.reschedule ?? rescheduleShiftNotifications
	try {
		const state = prepareRestoredAppState(backup)
		await replace(state)
		await reschedule({
			profiles: state.profiles,
			settings: state.notificationSettings,
		})
		return { ok: true, value: state }
	} catch (error) {
		console.warn('[backup] restore failed', error)
		return {
			ok: false,
			code: 'restore_failed',
			message: BACKUP_ERROR_MESSAGES.restore_failed,
		}
	}
}
