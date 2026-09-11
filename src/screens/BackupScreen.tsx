/**
 * Backup / restore screen — export share sheet + import with preview.
 *
 * Restore never runs on file pick alone; the user must confirm the
 * destructive replace after reviewing the preview card.
 */

import { useCallback, useState } from 'react'
import { Alert, StyleSheet, Text, View } from 'react-native'

import { Screen } from '@/src/components/Screen'
import { AppButton, SurfaceCard } from '@/src/components/ui'
import {
	applyBackupRestore,
	exportAndShareBackup,
	pickAndParseBackup,
} from '@/src/backup'
import {
	buildBackupPayload,
	buildBackupPreview,
	type BackupPayload,
	type BackupPreview,
} from '@/src/domain'
import { useAppBootstrap } from '@/src/features/bootstrap/AppBootstrap'
import { spacing, typography, useTheme } from '@/src/theme'

export function BackupScreen () {
	const { colors } = useTheme()
	const {
		profiles,
		activeProfile,
		salarySettings,
		notificationSettings,
		reloadAfterRestore,
	} = useAppBootstrap()
	const [busy, setBusy] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [status, setStatus] = useState<string | null>(null)
	const [pending, setPending] = useState<{
		backup: BackupPayload
		preview: BackupPreview
	} | null>(null)

	const handleCreate = useCallback(() => {
		if (busy) {
			return
		}
		if (profiles.length === 0) {
			setError('Сначала создайте хотя бы один график.')
			setStatus(null)
			return
		}
		setBusy(true)
		setError(null)
		setStatus(null)
		void (async () => {
			try {
				const payload = buildBackupPayload({
					profiles,
					activeProfileId: activeProfile?.id ?? null,
					salarySettings,
					notificationSettings,
				})
				const exported = await exportAndShareBackup(payload)
				setStatus(`Файл готов: ${exported.fileName}`)
				setPending(null)
			} catch (err) {
				console.warn('[backup] export failed', err)
				setError('Не удалось создать резервную копию.')
			} finally {
				setBusy(false)
			}
		})()
	}, [
		activeProfile,
		busy,
		notificationSettings,
		profiles,
		salarySettings,
	])

	const handlePick = useCallback(() => {
		if (busy) {
			return
		}
		setBusy(true)
		setError(null)
		setStatus(null)
		void (async () => {
			try {
				const parsed = await pickAndParseBackup()
				if (parsed == null) {
					return
				}
				if (!parsed.ok) {
					setPending(null)
					setError(parsed.message)
					return
				}
				setPending({
					backup: parsed.value,
					preview: buildBackupPreview(parsed.value),
				})
			} catch (err) {
				console.warn('[backup] pick failed', err)
				setPending(null)
				setError('Файл повреждён')
			} finally {
				setBusy(false)
			}
		})()
	}, [busy])

	const runRestore = useCallback(() => {
		if (!pending || busy) {
			return
		}
		setBusy(true)
		setError(null)
		void (async () => {
			try {
				const result = await applyBackupRestore(pending.backup)
				if (!result.ok) {
					setError(result.message)
					return
				}
				await reloadAfterRestore()
				setPending(null)
				setStatus('Данные восстановлены из резервной копии.')
			} catch (err) {
				console.warn('[backup] apply restore failed', err)
				setError('Не удалось восстановить данные')
			} finally {
				setBusy(false)
			}
		})()
	}, [busy, pending, reloadAfterRestore])

	const handleRestorePress = useCallback(() => {
		if (!pending) {
			return
		}
		Alert.alert(
			'Восстановить данные?',
			'Текущие данные будут заменены. Это действие нельзя отменить.',
			[
				{ text: 'Отмена', style: 'cancel' },
				{
					text: 'Восстановить',
					style: 'destructive',
					onPress: () => {
						runRestore()
					},
				},
			],
		)
	}, [pending, runRestore])

	return (
		<Screen
			includeBottomSafeArea={false}
			contentStyle={styles.content}
		>
			<Text style={[styles.lead, { color: colors.textSecondary }]}>
				Сохраните графики, оплату и уведомления в JSON-файл на устройстве
				или восстановите их из ранее созданной копии. Облако не
				используется.
			</Text>

			<SurfaceCard style={styles.card}>
				<Text style={[styles.section, { color: colors.textTertiary }]}>
					Создание
				</Text>
				<Text style={[styles.body, { color: colors.textSecondary }]}>
					Файл можно сохранить через системное меню «Поделиться».
				</Text>
				<AppButton
					label={busy ? 'Подождите…' : 'Создать резервную копию'}
					disabled={busy}
					onPress={handleCreate}
				/>
			</SurfaceCard>

			<SurfaceCard style={styles.card}>
				<Text style={[styles.section, { color: colors.textTertiary }]}>
					Восстановление
				</Text>
				<Text style={[styles.body, { color: colors.textSecondary }]}>
					Выберите JSON-файл. Текущие данные будут заменены только после
					подтверждения.
				</Text>
				<AppButton
					label="Восстановить из файла"
					variant="secondary"
					disabled={busy}
					onPress={handlePick}
				/>
			</SurfaceCard>

			{pending ? (
				<SurfaceCard style={styles.card}>
					<Text style={[styles.section, { color: colors.textTertiary }]}>
						Проверка файла
					</Text>
					<Text style={[styles.bodyStrong, { color: colors.textPrimary }]}>
						{`Резервная копия от ${pending.preview.createdAtLabel}`}
					</Text>
					<Text style={[styles.body, { color: colors.textSecondary }]}>
						{`Графиков: ${pending.preview.profileCount}`}
					</Text>
					<Text style={[styles.body, { color: colors.textSecondary }]}>
						{`Основной: ${pending.preview.primaryName}`}
					</Text>
					<Text style={[styles.body, { color: colors.textSecondary }]}>
						{`Зарплата: ${pending.preview.salaryLabel}`}
					</Text>
					<Text style={[styles.body, { color: colors.textSecondary }]}>
						{`Уведомления: ${pending.preview.notificationsLabel}`}
					</Text>
					<Text style={[styles.warn, { color: colors.danger }]}>
						Текущие данные будут заменены.
					</Text>
					<AppButton
						label={busy ? 'Восстановление…' : 'Восстановить'}
						disabled={busy}
						onPress={handleRestorePress}
					/>
					<AppButton
						label="Отменить"
						variant="ghost"
						disabled={busy}
						onPress={() => {
							setPending(null)
						}}
					/>
				</SurfaceCard>
			) : null}

			{error ? (
				<SurfaceCard style={styles.card}>
					<Text style={[styles.body, { color: colors.danger }]}>
						{error}
					</Text>
				</SurfaceCard>
			) : null}

			{status ? (
				<SurfaceCard style={styles.card}>
					<Text style={[styles.body, { color: colors.primary }]}>
						{status}
					</Text>
				</SurfaceCard>
			) : null}

			<View style={styles.bottomSpacer} />
		</Screen>
	)
}

const styles = StyleSheet.create({
	content: {
		paddingBottom: spacing.xxl,
		gap: spacing.sm,
	},
	lead: {
		...typography.body,
		marginBottom: spacing.xs,
	},
	card: {
		gap: spacing.sm,
		marginBottom: spacing.sm,
	},
	section: {
		...typography.label,
	},
	body: {
		...typography.body,
	},
	bodyStrong: {
		...typography.bodyStrong,
	},
	warn: {
		...typography.caption,
	},
	bottomSpacer: {
		height: spacing.xl,
	},
})
