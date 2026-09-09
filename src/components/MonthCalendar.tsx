/**
 * Month grid. Cells display the day number plus the shift letter.
 * Color is secondary; Д / Н / В is always visible.
 */

import { Pressable, StyleSheet, Text, View } from 'react-native'

import {
	WEEKDAY_LABELS_MONDAY_FIRST,
	type MonthGridCell,
} from '@/src/domain'
import type { ShiftType } from '@/src/types'
import {
	radius,
	shiftPalette,
	spacing,
	touchTarget,
	typography,
	useTheme,
} from '@/src/theme'

type MonthCalendarProps = {
	cells: MonthGridCell[]
	shiftsByDate: Record<string, ShiftType>
	todayDate: string
	selectedDate: string
	onSelectDate: (date: string) => void
}

export function MonthCalendar ({
	cells,
	shiftsByDate,
	todayDate,
	selectedDate,
	onSelectDate,
}: MonthCalendarProps) {
	const { colors } = useTheme()

	return (
		<View style={styles.wrap}>
			<View style={styles.weekRow}>
				{WEEKDAY_LABELS_MONDAY_FIRST.map((label) => (
					<Text
						key={label}
						style={[styles.weekday, { color: colors.textTertiary }]}
					>
						{label}
					</Text>
				))}
			</View>
			<View style={styles.grid}>
				{cells.map((cell) => {
					const shift = shiftsByDate[cell.date]
					const palette = shiftPalette(
						shift?.color ?? 'off',
						colors,
					)
					const isToday = cell.date === todayDate
					const isSelected = cell.date === selectedDate
					const faded = cell.inCurrentMonth ? 1 : 0.38

					return (
						<Pressable
							key={cell.date}
							accessibilityRole="button"
							accessibilityLabel={
								shift
									? `${cell.day}, ${shift.name}`
									: String(cell.day)
							}
							accessibilityState={{ selected: isSelected }}
							onPress={() => onSelectDate(cell.date)}
							style={[
								styles.cell,
								{
									backgroundColor: isSelected
										? colors.primaryMuted
										: palette.background,
									borderColor: isToday
										? colors.todayRing
										: isSelected
											? colors.primary
											: 'transparent',
									opacity: faded,
								},
							]}
						>
							<Text
								style={[
									styles.dayNumber,
									{ color: colors.textPrimary },
								]}
							>
								{cell.day}
							</Text>
							<Text
								style={[
									styles.shiftLetter,
									{ color: palette.foreground },
								]}
							>
								{shift?.shortName ?? ''}
							</Text>
						</Pressable>
					)
				})}
			</View>
		</View>
	)
}

const styles = StyleSheet.create({
	wrap: {
		gap: spacing.xs,
	},
	weekRow: {
		flexDirection: 'row',
	},
	weekday: {
		flex: 1,
		textAlign: 'center',
		...typography.label,
		paddingBottom: spacing.xxs,
	},
	grid: {
		flexDirection: 'row',
		flexWrap: 'wrap',
	},
	cell: {
		width: '14.285%',
		minHeight: touchTarget.min + 8,
		borderRadius: radius.sm,
		borderWidth: 2,
		alignItems: 'center',
		justifyContent: 'center',
		paddingVertical: spacing.xxs,
		marginBottom: 2,
	},
	dayNumber: {
		...typography.calendarDay,
	},
	shiftLetter: {
		...typography.calendarShift,
	},
})
