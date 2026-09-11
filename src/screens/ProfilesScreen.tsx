/**
 * Manage schedule profiles: list, rename, delete, add.
 */

import { useMemo, useState } from 'react'
import {
	Alert,
	Modal,
	Pressable,
	StyleSheet,
	Text,
	View,
} from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'

import { Screen } from '@/src/components/Screen'
import { AppButton, AppTextField, SurfaceCard } from '@/src/components/ui'
import {
	formatCycleLetters,
	getEffectiveDay,
	MAX_PROFILE_NAME_LENGTH,
	todayCalendarDate,
} from '@/src/domain'
import { useAppBootstrap } from '@/src/features/bootstrap/AppBootstrap'
import type { MoreStackParamList } from '@/src/navigation/types'
import {
	profileAccentPalette,
	spacing,
	typography,
	useTheme,
} from '@/src/theme'

type Props = NativeStackScreenProps<MoreStackParamList, 'MySchedules'>

export function ProfilesScreen ({ navigation }: Props) {
	const { colors, scheme } = useTheme()
	const {
		profiles,
		activeProfile,
		canAddProfile,
		setActiveProfileId,
		renameProfileById,
		deleteProfileById,
	} = useAppBootstrap()
	const today = todayCalendarDate()
	const [renameId, setRenameId] = useState<string | null>(null)
	const [renameValue, setRenameValue] = useState('')

	const renameTarget = useMemo(
		() => profiles.find((item) => item.id === renameId) ?? null,
		[profiles, renameId],
	)

	const handleDelete = (id: string, name: string) => {
		Alert.alert(
			`Удалить график «${name}»?`,
			'Смены и изменения этого графика будут удалены.',
			[
				{ text: 'Отмена', style: 'cancel' },
				{
					text: 'Удалить',
					style: 'destructive',
					onPress: () => {
						void deleteProfileById(id)
					},
				},
			],
		)
	}

	return (
		<Screen includeBottomSafeArea={false}>
			<View style={styles.list}>
				{profiles.map((profile) => {
					const accent = profileAccentPalette(profile.accent, scheme)
					const selected = profile.id === activeProfile?.id
					const todayShift = getEffectiveDay(
						profile.schedule,
						today,
						profile.overrides,
					).shift
					return (
						<SurfaceCard key={profile.id} style={styles.card}>
							<Pressable
								accessibilityRole="button"
								accessibilityState={{ selected }}
								onPress={() => {
									void setActiveProfileId(profile.id)
								}}
							>
								<View style={styles.cardHeader}>
									<View
										style={[
											styles.dot,
											{ backgroundColor: accent.foreground },
										]}
									/>
									<Text
										style={[
											styles.name,
											{ color: colors.textPrimary },
										]}
									>
										{profile.name}
									</Text>
									{profile.isPrimary ? (
										<Text
											style={[
												styles.badge,
												{ color: colors.textTertiary },
											]}
										>
											Основной
										</Text>
									) : null}
									{selected ? (
										<Text
											style={[
												styles.badge,
												{ color: colors.primary },
											]}
										>
											активен
										</Text>
									) : null}
								</View>
								<Text
									style={[
										styles.cycle,
										{ color: colors.textSecondary },
									]}
								>
									{formatCycleLetters(
										profile.schedule.cycle,
										profile.schedule.shiftTypes,
										' ',
									)}
								</Text>
								<Text
									style={[
										styles.today,
										{ color: colors.textSecondary },
									]}
								>
									Сегодня: {todayShift.shortName} · {todayShift.name}
								</Text>
							</Pressable>
							<View style={styles.actions}>
								<AppButton
									label="Переименовать"
									variant="secondary"
									compact
									onPress={() => {
										setRenameId(profile.id)
										setRenameValue(profile.name)
									}}
								/>
								{profile.isPrimary ? null : (
									<AppButton
										label="Удалить"
										variant="danger"
										compact
										onPress={() => handleDelete(
											profile.id,
											profile.name,
										)}
									/>
								)}
							</View>
						</SurfaceCard>
					)
				})}
			</View>
			<View style={styles.footer}>
				<AppButton
					label="Добавить график"
					disabled={!canAddProfile}
					onPress={() => {
						navigation.getParent()?.getParent()?.navigate(
							'AddProfile' as never,
						)
					}}
				/>
			</View>

			<Modal
				visible={renameTarget != null}
				transparent
				animationType="fade"
				onRequestClose={() => setRenameId(null)}
			>
				<Pressable
					style={[styles.backdrop, { backgroundColor: colors.overlay }]}
					onPress={() => setRenameId(null)}
				>
					<Pressable
						style={[
							styles.renameSheet,
							{
								backgroundColor: colors.surface,
								borderColor: colors.border,
							},
						]}
						onPress={() => undefined}
					>
						<Text
							style={[
								styles.renameTitle,
								{ color: colors.textPrimary },
							]}
						>
							Имя графика
						</Text>
						<AppTextField
							label="Название"
							value={renameValue}
							onChangeText={setRenameValue}
							maxLength={MAX_PROFILE_NAME_LENGTH}
						/>
						<AppButton
							label="Сохранить"
							onPress={() => {
								if (renameTarget) {
									void renameProfileById(
										renameTarget.id,
										renameValue,
									)
								}
								setRenameId(null)
							}}
						/>
					</Pressable>
				</Pressable>
			</Modal>
		</Screen>
	)
}

const styles = StyleSheet.create({
	list: {
		gap: spacing.md,
	},
	card: {
		gap: spacing.sm,
	},
	cardHeader: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: spacing.sm,
	},
	dot: {
		width: 10,
		height: 10,
		borderRadius: 5,
	},
	name: {
		...typography.subtitle,
		flex: 1,
	},
	badge: {
		...typography.caption,
	},
	cycle: {
		...typography.body,
	},
	today: {
		...typography.caption,
	},
	actions: {
		flexDirection: 'row',
		gap: spacing.sm,
	},
	footer: {
		marginTop: spacing.lg,
		paddingBottom: spacing.xl,
	},
	backdrop: {
		flex: 1,
		justifyContent: 'center',
		padding: spacing.lg,
	},
	renameSheet: {
		borderRadius: 16,
		borderWidth: 1,
		padding: spacing.lg,
		gap: spacing.md,
	},
	renameTitle: {
		...typography.subtitle,
	},
})
