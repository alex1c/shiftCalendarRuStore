/**
 * Selected-day summary under the month grid.
 * Uses the effective day (cycle + optional override), not JSX math.
 */

import { StyleSheet, Text, View } from 'react-native'

import { AppButton } from '@/src/components/ui'
import {
	effectiveWorkMinutes,
	formatDurationMinutes,
	formatShiftHours,
	formatShiftTitle,
	formatWeekdayDayMonth,
	isEffectiveWorkDay,
	type EffectiveDay,
} from '@/src/domain'
import {
	radius,
	shiftPalette,
	spacing,
	typography,
	useTheme,
} from '@/src/theme'

type DayDetailsProps = {
	day: EffectiveDay
	onEdit: () => void
	onRestore?: () => void
}

export function DayDetails ({ day, onEdit, onRestore }: DayDetailsProps) {
	const { colors } = useTheme()
	const { shift, override, isOverridden } = day
	const hours = formatShiftHours(shift)
	const palette = shiftPalette(shift.color, colors)
	const showWork = isEffectiveWorkDay(day)
	const worked = effectiveWorkMinutes(day)
	const overtimeMinutes = override?.type === 'overtime'
		? override.overtimeMinutes
		: 0
	const durationLabel = showWork
		? override?.type === 'overtime'
			? null
			: shift.breakMinutes > 0
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
				{formatWeekdayDayMonth(day.date)}
			</Text>
			<AppButton
				label={isOverridden ? 'Изменить' : 'Изменить день'}
				onPress={onEdit}
			/>
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
					{showWork && shift.breakMinutes > 0 && override?.type !== 'overtime' ? (
						<Text
							style={[
								styles.hours,
								{ color: colors.textTertiary },
							]}
						>
							{`Перерыв: ${shift.breakMinutes} мин`}
						</Text>
					) : null}
					{overtimeMinutes > 0 ? (
						<Text
							style={[
								styles.hours,
								{ color: colors.textSecondary },
							]}
						>
							{`Переработка: ${formatDurationMinutes(overtimeMinutes)}`}
						</Text>
					) : null}
					{isOverridden ? (
						<Text
							style={[
								styles.hours,
								{ color: colors.accent },
							]}
						>
							Изменено вручную
						</Text>
					) : null}
					{override?.note ? (
						<Text
							style={[
								styles.note,
								{ color: colors.textSecondary },
							]}
						>
							{override.note}
						</Text>
					) : null}
				</View>
			</View>
			{isOverridden && onRestore ? (
				<AppButton
					label="Вернуть по графику"
					variant="secondary"
					onPress={onRestore}
				/>
			) : null}
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
	note: {
		...typography.caption,
		marginTop: 2,
	},
})
