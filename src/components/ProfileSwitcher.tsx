/**
 * Compact active-profile control used on Calendar, Today and Statistics.
 */

import { useMemo, useState } from 'react'
import {
	Modal,
	Pressable,
	StyleSheet,
	Text,
	View,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'

import { useAppBootstrap } from '@/src/features/bootstrap/AppBootstrap'
import {
	profileAccentPalette,
	spacing,
	touchTarget,
	typography,
	useTheme,
} from '@/src/theme'

type ProfileSwitcherProps = {
	onAdd?: () => void
}

export function ProfileSwitcher ({ onAdd }: ProfileSwitcherProps) {
	const { colors, scheme } = useTheme()
	const navigation = useNavigation()
	const {
		profiles,
		activeProfile,
		canAddProfile,
		setActiveProfileId,
	} = useAppBootstrap()
	const [open, setOpen] = useState(false)

	const openAddProfile = () => {
		if (onAdd) {
			onAdd()
			return
		}
		const nested = navigation.getParent()?.getParent()
		const root = nested ?? navigation.getParent() ?? navigation
		root.navigate('AddProfile' as never)
	}

	const label = activeProfile?.name ?? 'График'
	const accent = profileAccentPalette(
		activeProfile?.accent ?? 'blue',
		scheme,
	)

	const items = useMemo(() => profiles, [profiles])

	if (profiles.length === 0) {
		return null
	}

	return (
		<>
			<Pressable
				accessibilityRole="button"
				accessibilityLabel={`График: ${label}`}
				onPress={() => setOpen(true)}
				style={({ pressed }) => [
					styles.trigger,
					{
						backgroundColor: colors.surface,
						borderColor: colors.border,
						opacity: pressed ? 0.85 : 1,
					},
				]}
			>
				<View
					style={[
						styles.dot,
						{ backgroundColor: accent.foreground },
					]}
				/>
				<Text
					style={[styles.triggerLabel, { color: colors.textPrimary }]}
					numberOfLines={1}
				>
					{label}
				</Text>
				<Text style={[styles.chevron, { color: colors.textTertiary }]}>
					▼
				</Text>
			</Pressable>

			<Modal
				visible={open}
				transparent
				animationType="fade"
				onRequestClose={() => setOpen(false)}
			>
				<Pressable
					style={[styles.backdrop, { backgroundColor: colors.overlay }]}
					onPress={() => setOpen(false)}
				>
					<Pressable
						style={[
							styles.sheet,
							{
								backgroundColor: colors.surface,
								borderColor: colors.border,
							},
						]}
						onPress={() => undefined}
					>
						<Text
							style={[
								styles.sheetTitle,
								{ color: colors.textTertiary },
							]}
						>
							График
						</Text>
						{items.map((profile) => {
							const selected = profile.id === activeProfile?.id
							const itemAccent = profileAccentPalette(
								profile.accent,
								scheme,
							)
							return (
								<Pressable
									key={profile.id}
									accessibilityRole="button"
									accessibilityState={{ selected }}
									onPress={() => {
										void setActiveProfileId(profile.id)
										setOpen(false)
									}}
									style={({ pressed }) => [
										styles.row,
										{
											backgroundColor: selected
												? colors.primaryMuted
												: pressed
													? colors.surfaceMuted
													: 'transparent',
										},
									]}
								>
									<View
										style={[
											styles.dot,
											{ backgroundColor: itemAccent.foreground },
										]}
									/>
									<Text
										style={[
											styles.rowLabel,
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
								</Pressable>
							)
						})}
						{canAddProfile ? (
							<Pressable
								accessibilityRole="button"
								onPress={() => {
									setOpen(false)
									openAddProfile()
								}}
								style={({ pressed }) => [
									styles.row,
									{
										backgroundColor: pressed
											? colors.surfaceMuted
											: 'transparent',
									},
								]}
							>
								<Text
									style={[
										styles.addLabel,
										{ color: colors.primary },
									]}
								>
									+ Добавить
								</Text>
							</Pressable>
						) : null}
					</Pressable>
				</Pressable>
			</Modal>
		</>
	)
}

const styles = StyleSheet.create({
	trigger: {
		minHeight: touchTarget.min,
		paddingHorizontal: spacing.md,
		borderRadius: 12,
		borderWidth: 1,
		flexDirection: 'row',
		alignItems: 'center',
		gap: spacing.xs,
		alignSelf: 'flex-start',
		maxWidth: '100%',
	},
	triggerLabel: {
		...typography.bodyStrong,
		flexShrink: 1,
	},
	chevron: {
		...typography.caption,
	},
	dot: {
		width: 8,
		height: 8,
		borderRadius: 4,
	},
	backdrop: {
		flex: 1,
		justifyContent: 'flex-end',
		padding: spacing.lg,
	},
	sheet: {
		borderRadius: 16,
		borderWidth: 1,
		padding: spacing.md,
		paddingBottom: spacing.lg,
		gap: spacing.xxs,
	},
	sheetTitle: {
		...typography.label,
		marginBottom: spacing.xs,
		paddingHorizontal: spacing.xs,
	},
	row: {
		minHeight: touchTarget.min,
		borderRadius: 12,
		paddingHorizontal: spacing.sm,
		flexDirection: 'row',
		alignItems: 'center',
		gap: spacing.sm,
	},
	rowLabel: {
		...typography.body,
		flex: 1,
	},
	badge: {
		...typography.caption,
	},
	addLabel: {
		...typography.bodyStrong,
	},
})
