/**
 * Public backup adapters — file I/O and restore orchestration.
 */

export {
	exportAndShareBackup,
	pickAndParseBackup,
	shareBackupFile,
	writeBackupFile,
	type ExportedBackupFile,
} from './BackupFileService'
export {
	applyBackupRestore,
	type ApplyBackupRestoreResult,
} from './restore'
