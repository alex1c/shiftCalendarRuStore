/**
 * Selected-day summary under the month grid.
 * Duration and break copy come from domain helpers, not JSX math.
 */

import { StyleSheet, Text, View } from 'react-native'

import {
	formatDurationMinutes,
	formatShiftHours,
	formatShiftTitle,
	formatWeekdayDayMonth,
	isWorkShift,
	workDurationMinutes,
} from '@/src/domain'
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
	const worked = workDurationMinutes(shift)
	const showWork = isWorkShift(shift)
	const durationLabel = showWork
		? shift.breakMinutes > 0
			? `${formatDurationMinutes(worked)} работы`
			: formatDurationMinutes(worked)
		: null

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
				{formatWeekdayDayMonth(date)}
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
						numberOfLines={1}
					>
						{shift.shortName}
					</Text>
				</View>
				<View style={styles.meta}>
					<Text
						style={[styles.name, { color: colors.textPrimary }]}
					>
						{formatShiftTitle(shift)}
					</Text>
					{hours ? (
						<Text
							style={[
								styles.hours,
								{ color: colors.textSecondary },
							]}
						>
							{hours}
						</Text>
					) : null}
					{durationLabel ? (
						<Text
							style={[
								styles.hours,
								{ color: colors.textSecondary },
							]}
						>
							{durationLabel}
						</Text>
					) : null}
					{showWork && shift.breakMinutes > 0 ? (
						<Text
							style={[
								styles.hours,
								{ color: colors.textTertiary },
							]}
						>
							{`Перерыв: ${shift.breakMinutes} мин`}
						</Text>
					) : null}
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
		minWidth: 44,
		height: 44,
		borderRadius: radius.sm,
		alignItems: 'center',
		justifyContent: 'center',
		paddingHorizontal: spacing.xs,
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
