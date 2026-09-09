/**
 * Selectable preset card showing name, description and visual cycle.
 */

import { Pressable, StyleSheet, Text, View } from 'react-native'

import { CycleChips } from '@/src/components/CycleChips'
import type { SchedulePreset } from '@/src/types'
import {
	elevation,
	radius,
	spacing,
	typography,
	useTheme,
} from '@/src/theme'

type PresetCardProps = {
	preset: SchedulePreset
	selected?: boolean
	onPress: () => void
}

export function PresetCard ({
	preset,
	selected = false,
	onPress,
}: PresetCardProps) {
	const { colors } = useTheme()

	return (
		<Pressable
			accessibilityRole="button"
			accessibilityState={{ selected }}
			accessibilityLabel={`${preset.name}. ${preset.description}`}
			onPress={onPress}
			style={({ pressed }) => [
				styles.card,
				{
					backgroundColor: colors.surface,
					borderColor: selected ? colors.primary : colors.border,
					borderWidth: selected ? 2 : 1,
					opacity: pressed ? 0.92 : 1,
				},
			]}
		>
			<View style={styles.header}>
				<Text style={[styles.title, { color: colors.textPrimary }]}>
					{preset.name}
				</Text>
				<Text
					style={[styles.description, { color: colors.textSecondary }]}
				>
					{preset.description}
				</Text>
			</View>
			<CycleChips cycle={preset.cycle} />
		</Pressable>
	)
}

const styles = StyleSheet.create({
	card: {
		borderRadius: radius.lg,
		padding: spacing.md,
		gap: spacing.sm,
		...elevation.sm,
	},
	header: {
		gap: spacing.xxs,
	},
	title: {
		...typography.subtitle,
	},
	description: {
		...typography.caption,
	},
})
