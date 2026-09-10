/**
 * Shared rolling / calendar period chips used by Statistics and Salary.
 */

import { Pressable, StyleSheet, Text, View } from 'react-native'

import {
	STATS_PERIOD_OPTIONS,
	type StatsPeriodKind,
} from '@/src/domain'
import { radius, spacing, touchTarget, typography, useTheme } from '@/src/theme'

type PeriodChipsProps = {
	value: StatsPeriodKind
	onChange: (kind: StatsPeriodKind) => void
}

export function PeriodChips ({ value, onChange }: PeriodChipsProps) {
	const { colors } = useTheme()

	return (
		<View style={styles.chips}>
			{STATS_PERIOD_OPTIONS.map((option) => {
				const selected = value === option.kind
				return (
					<Pressable
						key={option.kind}
						accessibilityRole="button"
						accessibilityState={{ selected }}
						onPress={() => onChange(option.kind)}
						style={({ pressed }) => [
							styles.chip,
							{
								backgroundColor: selected
									? colors.primaryMuted
									: colors.surface,
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
							{option.label}
						</Text>
					</Pressable>
				)
			})}
		</View>
	)
}

const styles = StyleSheet.create({
	chips: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: spacing.xs,
		marginBottom: spacing.sm,
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
})
