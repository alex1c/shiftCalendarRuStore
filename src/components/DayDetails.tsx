/**
 * Selected-day summary under the month grid.
 */

import { StyleSheet, Text, View } from 'react-native'

import { formatDayMonth, formatShiftHours } from '@/src/domain'
import type { ShiftType } from '@/src/types'
import {
	radius,
	shiftPalette,
	spacing,
	typography,
	useTheme,
} from '@/src/theme'

type DayDetailsProps = {
	date: string
	shift: ShiftType
}

export function DayDetails ({ date, shift }: DayDetailsProps) {
	const { colors } = useTheme()
	const hours = formatShiftHours(shift)
	const palette = shiftPalette(shift.color, colors)

	return (
		<View
			style={[
				styles.card,
				{
					backgroundColor: colors.surface,
					borderColor: colors.border,
				},
			]}
		>
			<Text style={[styles.date, { color: colors.textPrimary }]}>
				{formatDayMonth(date)}
			</Text>
			<View style={styles.row}>
				<View
					style={[
						styles.badge,
						{ backgroundColor: palette.background },
					]}
				>
					<Text
						style={[
							styles.badgeLetter,
							{ color: palette.foreground },
						]}
					>
						{shift.shortName}
					</Text>
				</View>
				<View style={styles.meta}>
					<Text
						style={[styles.name, { color: colors.textPrimary }]}
					>
						{shift.name}
					</Text>
					<Text
						style={[
							styles.hours,
							{ color: colors.textSecondary },
						]}
					>
						{hours ?? 'Без рабочего времени'}
					</Text>
				</View>
			</View>
		</View>
	)
}

const styles = StyleSheet.create({
	card: {
		borderRadius: radius.lg,
		borderWidth: 1,
		padding: spacing.md,
		gap: spacing.sm,
	},
	date: {
		...typography.subtitle,
	},
	row: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: spacing.sm,
	},
	badge: {
		width: 40,
		height: 40,
		borderRadius: radius.sm,
		alignItems: 'center',
		justifyContent: 'center',
	},
	badgeLetter: {
		...typography.subtitle,
	},
	meta: {
		flex: 1,
		gap: 2,
	},
	name: {
		...typography.bodyStrong,
	},
	hours: {
		...typography.caption,
	},
})
