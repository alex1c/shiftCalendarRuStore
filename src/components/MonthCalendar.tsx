/**
 * Month grid. Each cell shows the day number and shift shortName.
 * Today, selected, and today+selected are distinct visual states.
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
	const rows: MonthGridCell[][] = []
	for (let row = 0; row < 6; row += 1) {
		rows.push(cells.slice(row * 7, row * 7 + 7))
	}

	return (
		<View style={styles.wrap}>
			<View style={styles.weekRow}>
				{WEEKDAY_LABELS_MONDAY_FIRST.map((label, index) => {
					const isWeekend = index >= 5
					return (
						<Text
							key={label}
							style={[
								styles.weekday,
								{
									color: isWeekend
										? colors.weekendText
										: colors.textTertiary,
								},
							]}
						>
							{label}
						</Text>
					)
				})}
			</View>
			<View style={styles.grid}>
				{rows.map((row) => (
					<View key={row[0]?.date ?? 'row'} style={styles.gridRow}>
						{row.map((cell, column) => {
							const shift = shiftsByDate[cell.date]
							const palette = shiftPalette(
								shift?.color ?? 'off',
								colors,
							)
							const isToday = cell.date === todayDate
							const isSelected = cell.date === selectedDate
							const isWeekend = column >= 5
							const faded = !cell.inCurrentMonth && !isSelected

							let backgroundColor = palette.background
							let borderColor = 'transparent'
							let borderWidth = 2
							if (isSelected && isToday) {
								backgroundColor = colors.primaryMuted
								borderColor = colors.todayRing
								borderWidth = 3
							} else if (isSelected) {
								backgroundColor = colors.primaryMuted
								borderColor = colors.primary
								borderWidth = 2
							} else if (isToday) {
								borderColor = colors.todayRing
								borderWidth = 3
							}

							const shortName = shift?.shortName ?? ''

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
											backgroundColor,
											borderColor,
											borderWidth,
											opacity: faded ? 0.4 : 1,
										},
									]}
								>
									<Text
										style={[
											styles.dayNumber,
											{
												color: isWeekend && cell.inCurrentMonth
													? colors.weekendText
													: colors.textPrimary,
											},
										]}
									>
										{cell.day}
									</Text>
									<Text
										style={[
											styles.shiftLetter,
											{
												color: palette.foreground,
												fontSize: shortName.length >= 3 ? 11 : 12,
											},
										]}
										numberOfLines={1}
									>
										{shortName}
									</Text>
								</Pressable>
							)
						})}
					</View>
				))}
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
		gap: 2,
	},
	gridRow: {
		flexDirection: 'row',
		gap: 2,
	},
	cell: {
		flex: 1,
		minHeight: touchTarget.min,
		borderRadius: radius.sm,
		alignItems: 'center',
		justifyContent: 'center',
		paddingVertical: spacing.xxs,
	},
	dayNumber: {
		...typography.calendarDay,
	},
	shiftLetter: {
		...typography.calendarShift,
	},
})
