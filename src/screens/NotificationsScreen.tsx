/**
 * Shift reminder settings — primary profile only.
 *
 * Permission is requested when the user turns reminders on, never on
 * first app launch. Native scheduling is owned by the bootstrap save
 * path, not by this screen.
 */

import { useCallback, useMemo, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'

import { Screen } from '@/src/components/Screen'
import { AppButton, AppSwitchRow, AppTextField, SurfaceCard } from '@/src/components/ui'
import {
	DEFAULT_PRIMARY_PROFILE_NAME,
	REMINDER_OFFSET_PRESETS,
	buildUpcomingShiftPreview,
	customOffsetToMinutes,
	defaultNotificationSettings,
	isPresetOffsetMinutes,
	normalizeReminderOffsets,
	type ReminderOffsetUnit,
} from '@/src/domain'
import { useAppBootstrap } from '@/src/features/bootstrap/AppBootstrap'
import {
	getNotificationPermissionStatus,
	openNotificationSettings,
	requestNotificationPermission,
	type NotificationPermissionStatus,
} from '@/src/notifications'
import { radius, spacing, touchTarget, typography, useTheme } from '@/src/theme'

function splitOffsets (offsets: readonly number[]): {
	presets: number[]
	customMinutes: number | null
} {
	const presets: number[] = []
	let customMinutes: number | null = null
	for (const value of offsets) {
		if (isPresetOffsetMinutes(value)) {
			presets.push(value)
		} else if (customMinutes == null) {
			customMinutes = value
		}
	}
	return { presets, customMinutes }
}

function customFieldsFromMinutes (minutes: number): {
	amount: string
	unit: ReminderOffsetUnit
} {
	if (minutes % 60 === 0) {
		return { amount: String(minutes / 60), unit: 'hours' }
	}
	return { amount: String(minutes), unit: 'minutes' }
}

export function NotificationsScreen () {
	const { colors } = useTheme()
	const {
		profiles,
		primaryProfile,
		notificationSettings,
		persistNotificationSettings,
	} = useAppBootstrap()
	const initial = notificationSettings ?? defaultNotificationSettings()
	const split = splitOffsets(initial.offsetsMinutes)
	const customSeed = split.customMinutes
		? customFieldsFromMinutes(split.customMinutes)
		: { amount: '90', unit: 'minutes' as ReminderOffsetUnit }

	const [enabled, setEnabled] = useState(initial.enabled)
	const [presetOffsets, setPresetOffsets] = useState(split.presets)
	const [customSelected, setCustomSelected] = useState(split.customMinutes != null)
	const [customAmount, setCustomAmount] = useState(customSeed.amount)
	const [customUnit, setCustomUnit] = useState<ReminderOffsetUnit>(customSeed.unit)
	const [permission, setPermission] =
		useState<NotificationPermissionStatus>('notDetermined')
	const [error, setError] = useState<string | null>(null)
	const [saving, setSaving] = useState(false)

	const refreshPermission = useCallback(async () => {
		const status = await getNotificationPermissionStatus()
		setPermission(status)
	}, [])

	useFocusEffect(
		useCallback(() => {
			void refreshPermission()
		}, [refreshPermission]),
	)

	const draftOffsets = useMemo(() => {
		const next = [...presetOffsets]
		if (customSelected) {
			const parsed = Number.parseInt(customAmount, 10)
			const minutes = customOffsetToMinutes(
				Number.isFinite(parsed) ? parsed : 0,
				customUnit,
			)
			if (minutes != null) {
				next.push(minutes)
			}
		}
		return normalizeReminderOffsets(next)
	}, [customAmount, customSelected, customUnit, presetOffsets])

	const preview = useMemo(
		() =>
			buildUpcomingShiftPreview({
				profiles,
				settings: {
					...initial,
					enabled: true,
					offsetsMinutes: draftOffsets,
				},
				now: new Date(),
			}),
		[draftOffsets, initial, profiles],
	)

	const selectedCount = presetOffsets.length + (customSelected ? 1 : 0)

	const handleToggleEnabled = useCallback((next: boolean) => {
		setEnabled(next)
		setError(null)
		if (!next) {
			return
		}
		void (async () => {
			const status = await requestNotificationPermission()
			setPermission(status)
		})()
	}, [])

	const handleTogglePreset = useCallback((minutes: number) => {
		setError(null)
		setPresetOffsets((current) => {
			if (current.includes(minutes)) {
				return current.filter((item) => item !== minutes)
			}
			const next = [...current, minutes]
			const room = customSelected ? 1 : 2
			while (next.length > room) {
				next.shift()
			}
			return next
		})
	}, [customSelected])

	const handleToggleCustom = useCallback(() => {
		setError(null)
		setCustomSelected((current) => {
			if (current) {
				return false
			}
			setPresetOffsets((presets) => {
				if (presets.length < 2) {
					return presets
				}
				return presets.slice(1)
			})
			return true
		})
	}, [])

	const handleSave = useCallback(() => {
		if (saving) {
			return
		}
		const offsets = draftOffsets
		if (customSelected) {
			const parsed = Number.parseInt(customAmount, 10)
			const minutes = customOffsetToMinutes(
				Number.isFinite(parsed) ? parsed : 0,
				customUnit,
			)
			if (minutes == null) {
				setError('Свой интервал: от 15 минут до 7 дней.')
				return
			}
		}
		if (offsets.length === 0) {
			setError('Выберите хотя бы одно напоминание.')
			return
		}
		setSaving(true)
		void (async () => {
			try {
				let nextEnabled = enabled
				if (enabled) {
					const status = await requestNotificationPermission()
					setPermission(status)
				}
				await persistNotificationSettings({
					...initial,
					enabled: nextEnabled,
					offsetsMinutes: offsets,
					updatedAt: new Date().toISOString(),
				})
				setError(null)
			} catch {
				setError('Не удалось сохранить настройки уведомлений.')
			} finally {
				setSaving(false)
			}
		})()
	}, [
		customAmount,
		customSelected,
		customUnit,
		draftOffsets,
		enabled,
		initial,
		persistNotificationSettings,
		saving,
	])

	const primaryName = primaryProfile?.name ?? DEFAULT_PRIMARY_PROFILE_NAME

	return (
		<Screen
			includeBottomSafeArea={false}
			contentStyle={styles.content}
		>
			<Text style={[styles.lead, { color: colors.textSecondary }]}>
				{`Напоминания относятся к основному графику: ${primaryName}`}
			</Text>

			<SurfaceCard style={styles.card}>
				<AppSwitchRow
					label="Напоминать о сменах"
					value={enabled}
					onValueChange={handleToggleEnabled}
				/>
			</SurfaceCard>

			<SurfaceCard style={styles.card}>
				<Text style={[styles.sectionLabel, { color: colors.textTertiary }]}>
					Разрешение
				</Text>
				{permission === 'granted' ? (
					<Text style={[styles.body, { color: colors.primary }]}>
						Уведомления включены
					</Text>
				) : null}
				{permission === 'notDetermined' ? (
					<Text style={[styles.body, { color: colors.textSecondary }]}>
						Разрешение будет запрошено при включении напоминаний.
					</Text>
				) : null}
				{permission === 'denied' ? (
					<View style={styles.deniedBlock}>
						<Text style={[styles.body, { color: colors.danger }]}>
							Уведомления запрещены в настройках Android
						</Text>
						<AppButton
							label="Открыть настройки"
							variant="secondary"
							onPress={() => {
								void openNotificationSettings()
							}}
						/>
					</View>
				) : null}
			</SurfaceCard>

			<SurfaceCard style={styles.card}>
				<Text style={[styles.sectionLabel, { color: colors.textTertiary }]}>
					Когда напоминать
				</Text>
				<Text style={[styles.hint, { color: colors.textSecondary }]}>
					Можно выбрать до двух интервалов.
				</Text>
				<View style={styles.chips}>
					{REMINDER_OFFSET_PRESETS.map((preset) => {
						const selected = presetOffsets.includes(preset.minutes)
						return (
							<Pressable
								key={preset.minutes}
								accessibilityRole="button"
								accessibilityState={{ selected }}
								onPress={() => handleTogglePreset(preset.minutes)}
								style={({ pressed }) => [
									styles.chip,
									{
										backgroundColor: selected
											? colors.primaryMuted
											: colors.surfaceMuted,
										borderColor: selected
											? colors.primary
											: colors.border,
										opacity: pressed ? 0.85 : 1,
									},
								]}
							>
								<Text
									style={[
										styles.chipLabel,
										{
											color: selected
												? colors.primary
												: colors.textPrimary,
										},
									]}
								>
									{preset.label}
								</Text>
							</Pressable>
						)
					})}
					<Pressable
						accessibilityRole="button"
						accessibilityState={{ selected: customSelected }}
						onPress={handleToggleCustom}
						style={({ pressed }) => [
							styles.chip,
							{
								backgroundColor: customSelected
									? colors.primaryMuted
									: colors.surfaceMuted,
								borderColor: customSelected
									? colors.primary
									: colors.border,
								opacity: pressed ? 0.85 : 1,
							},
						]}
					>
						<Text
							style={[
								styles.chipLabel,
								{
									color: customSelected
										? colors.primary
										: colors.textPrimary,
								},
							]}
						>
							Свой вариант
						</Text>
					</Pressable>
				</View>
				{customSelected ? (
					<View style={styles.customRow}>
						<View style={styles.customField}>
							<AppTextField
								label="Число"
								value={customAmount}
								onChangeText={(value) => {
									setCustomAmount(value.replace(/[^\d]/g, ''))
									setError(null)
								}}
								keyboardType="number-pad"
								placeholder="15"
								maxLength={4}
							/>
						</View>
						<View style={styles.unitChips}>
							{(
								[
									['minutes', 'минуты'],
									['hours', 'часы'],
								] as const
							).map(([unit, label]) => {
								const selected = customUnit === unit
								return (
									<Pressable
										key={unit}
										accessibilityRole="button"
										accessibilityState={{ selected }}
										onPress={() => {
											setCustomUnit(unit)
											setError(null)
										}}
										style={({ pressed }) => [
											styles.chip,
											{
												backgroundColor: selected
													? colors.primaryMuted
													: colors.surfaceMuted,
												borderColor: selected
													? colors.primary
													: colors.border,
												opacity: pressed ? 0.85 : 1,
											},
										]}
									>
										<Text
											style={[
												styles.chipLabel,
												{
													color: selected
														? colors.primary
														: colors.textPrimary,
												},
											]}
										>
											{label}
										</Text>
									</Pressable>
								)
							})}
						</View>
					</View>
				) : null}
				{error ? (
					<Text style={[styles.error, { color: colors.danger }]}>
						{error}
					</Text>
				) : null}
				<AppButton
					label={saving ? 'Сохранение…' : 'Сохранить'}
					disabled={saving || selectedCount === 0}
					onPress={handleSave}
					style={styles.save}
				/>
			</SurfaceCard>

			<SurfaceCard style={styles.card}>
				<Text style={[styles.sectionLabel, { color: colors.textTertiary }]}>
					Следующая смена
				</Text>
				{preview ? (
					<>
						<Text style={[styles.bodyStrong, { color: colors.textPrimary }]}>
							{preview.shiftLine}
						</Text>
						{preview.reminderLines.length > 0 ? (
							preview.reminderLines.map((line) => (
								<Text
									key={line}
									style={[styles.body, { color: colors.textSecondary }]}
								>
									{line}
								</Text>
							))
						) : (
							<Text style={[styles.body, { color: colors.textSecondary }]}>
								Напоминание для этой смены уже в прошлом.
							</Text>
						)}
					</>
				) : (
					<Text style={[styles.body, { color: colors.textSecondary }]}>
						Предстоящих рабочих смен нет
					</Text>
				)}
			</SurfaceCard>
		</Screen>
	)
}

const styles = StyleSheet.create({
	content: {
		paddingBottom: spacing.xxl,
		gap: spacing.sm,
	},
	lead: {
		...typography.caption,
		marginBottom: spacing.xs,
	},
	card: {
		gap: spacing.sm,
		marginBottom: spacing.sm,
	},
	sectionLabel: {
		...typography.label,
	},
	body: {
		...typography.body,
	},
	bodyStrong: {
		...typography.bodyStrong,
	},
	hint: {
		...typography.caption,
	},
	deniedBlock: {
		gap: spacing.sm,
	},
	chips: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: spacing.xs,
	},
	chip: {
		minHeight: touchTarget.min,
		paddingHorizontal: spacing.md,
		borderRadius: radius.md,
		borderWidth: 1.5,
		alignItems: 'center',
		justifyContent: 'center',
	},
	chipLabel: {
		...typography.bodyStrong,
	},
	customRow: {
		gap: spacing.sm,
	},
	customField: {
		flexGrow: 1,
	},
	unitChips: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: spacing.xs,
	},
	error: {
		...typography.caption,
	},
	save: {
		marginTop: spacing.xs,
	},
})
