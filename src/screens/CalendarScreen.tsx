/**
 * Main calendar — current month derived from the saved cycle.
 * Insights (next shift, month stats) use the same engine as the grid.
 */

import { useMemo, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'

import { DayDetails } from '@/src/components/DayDetails'
import { MonthCalendar } from '@/src/components/MonthCalendar'
import { Screen } from '@/src/components/Screen'
import {
	addMonths,
	buildMonthGrid,
	computeMonthStats,
	findNextWorkShift,
	formatCalendarDate,
	formatMonthStats,
	formatMonthYear,
	formatNextWorkShift,
	formatShiftHours,
	formatTodaySummary,
	parseCalendarDate,
	resolveShiftForDate,
	todayCalendarDate,
} from '@/src/domain'
import { useAppBootstrap } from '@/src/features/bootstrap/AppBootstrap'
import {
	radius,
	spacing,
	touchTarget,
	typography,
	useTheme,
} from '@/src/theme'

export function CalendarScreen () {
	const { colors } = useTheme()
	const { schedule } = useAppBootstrap()
	const today = todayCalendarDate()
	const todayParts = parseCalendarDate(today)

	const [visible, setVisible] = useState({
		year: todayParts.year,
		month: todayParts.month,
	})
	const [selectedDate, setSelectedDate] = useState(today)

	const cells = useMemo(
		() => buildMonthGrid(visible.year, visible.month),
		[visible.year, visible.month],
	)

	const shiftsByDate = useMemo(() => {
		if (!schedule) {
			return {}
		}
		return Object.fromEntries(
			cells.map((cell) => [
				cell.date,
				resolveShiftForDate(schedule, cell.date),
			]),
		)
	}, [cells, schedule])

	const selectedShift = schedule
		? resolveShiftForDate(schedule, selectedDate)
		: null
	const todayShift = schedule
		? resolveShiftForDate(schedule, today)
		: null

	const monthStats = useMemo(() => {
		if (!schedule) {
			return null
		}
		return computeMonthStats(schedule, visible.year, visible.month)
	}, [schedule, visible.year, visible.month])

	const nextShiftLabel = useMemo(() => {
		if (!schedule) {
			return null
		}
		return formatNextWorkShift(today, findNextWorkShift(schedule, today))
	}, [schedule, today])

	const isCurrentMonth =
		visible.year === todayParts.year &&
		visible.month === todayParts.month

	const goToMonth = (delta: number) => {
		const next = addMonths(visible.year, visible.month, delta)
		setVisible(next)
		const selected = parseCalendarDate(selectedDate)
		if (selected.year !== next.year || selected.month !== next.month) {
			setSelectedDate(formatCalendarDate(next.year, next.month, 1))
		}
	}

	const handleSelectDate = (date: string) => {
		const parts = parseCalendarDate(date)
		setSelectedDate(date)
		if (parts.year !== visible.year || parts.month !== visible.month) {
			setVisible({ year: parts.year, month: parts.month })
		}
	}

	const handleSelectToday = () => {
		setVisible({ year: todayParts.year, month: todayParts.month })
		setSelectedDate(today)
	}

	if (!schedule || !selectedShift || !todayShift) {
		return null
	}

	const todayHours = formatShiftHours(todayShift)

	return (
		<Screen includeBottomSafeArea={false}>
			<View style={styles.headerRow}>
				<HeaderIconButton
					icon="chevron-back"
					accessibilityLabel="Предыдущий месяц"
					onPress={() => goToMonth(-1)}
				/>
				<Text
					style={[styles.title, { color: colors.textPrimary }]}
					accessibilityRole="header"
				>
					{formatMonthYear(visible.year, visible.month)}
				</Text>
				<HeaderIconButton
					icon="chevron-forward"
					accessibilityLabel="Следующий месяц"
					onPress={() => goToMonth(1)}
				/>
			</View>
			<Pressable
				accessibilityRole="button"
				accessibilityLabel="Вернуться к текущему месяцу"
				disabled={isCurrentMonth && selectedDate === today}
				onPress={handleSelectToday}
				style={({ pressed }) => [
					styles.todayButton,
					{
						backgroundColor: colors.surface,
						borderColor: colors.border,
						opacity:
							isCurrentMonth && selectedDate === today
								? 0.45
								: pressed
									? 0.85
									: 1,
					},
				]}
			>
				<Text style={[styles.todayButtonLabel, { color: colors.primary }]}>
					Сегодня
				</Text>
			</Pressable>

			{isCurrentMonth ? (
				<View
					style={[
						styles.todaySummary,
						{
							backgroundColor: colors.surface,
							borderColor: colors.border,
						},
					]}
				>
					<Text
						style={[
							styles.todaySummaryTitle,
							{ color: colors.textPrimary },
						]}
						numberOfLines={1}
					>
						{formatTodaySummary(todayShift)}
					</Text>
					{todayHours ? (
						<Text
							style={[
								styles.todaySummaryHours,
								{ color: colors.textSecondary },
							]}
						>
							{todayHours}
						</Text>
					) : null}
				</View>
			) : null}

			<MonthCalendar
				cells={cells}
				shiftsByDate={shiftsByDate}
				todayDate={today}
				selectedDate={selectedDate}
				onSelectDate={handleSelectDate}
			/>

			<View style={styles.below}>
				{nextShiftLabel ? (
					<Text
						style={[styles.insight, { color: colors.textSecondary }]}
					>
						{nextShiftLabel}
					</Text>
				) : null}
				{monthStats ? (
					<Text
						style={[styles.insight, { color: colors.textSecondary }]}
					>
						{formatMonthStats(monthStats)}
					</Text>
				) : null}
				<DayDetails date={selectedDate} shift={selectedShift} />
			</View>
		</Screen>
	)
}

type HeaderIconButtonProps = {
	icon: 'chevron-back' | 'chevron-forward'
	accessibilityLabel: string
	onPress: () => void
}

function HeaderIconButton ({
	icon,
	accessibilityLabel,
	onPress,
}: HeaderIconButtonProps) {
	const { colors } = useTheme()
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={accessibilityLabel}
			onPress={onPress}
			hitSlop={4}
			style={({ pressed }) => [
				styles.headerButton,
				{
					backgroundColor: colors.surface,
					borderColor: colors.border,
					opacity: pressed ? 0.85 : 1,
				},
			]}
		>
			<Ionicons name={icon} size={26} color={colors.primary} />
		</Pressable>
	)
}

const styles = StyleSheet.create({
	headerRow: {
		flexDirection: 'row',
		alignItems: 'center',
		marginBottom: spacing.sm,
		gap: spacing.xs,
	},
	title: {
		...typography.title,
		flex: 1,
		textAlign: 'center',
	},
	headerButton: {
		minHeight: touchTarget.min,
		minWidth: touchTarget.min,
		borderRadius: radius.md,
		borderWidth: 1,
		alignItems: 'center',
		justifyContent: 'center',
	},
	todayButton: {
		minHeight: touchTarget.min,
		borderRadius: radius.md,
		borderWidth: 1,
		alignItems: 'center',
		justifyContent: 'center',
		marginBottom: spacing.sm,
	},
	todayButtonLabel: {
		...typography.bodyStrong,
	},
	todaySummary: {
		borderRadius: radius.md,
		borderWidth: 1,
		paddingHorizontal: spacing.md,
		paddingVertical: spacing.sm,
		marginBottom: spacing.md,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		gap: spacing.sm,
	},
	todaySummaryTitle: {
		...typography.bodyStrong,
		flex: 1,
	},
	todaySummaryHours: {
		...typography.caption,
	},
	below: {
		marginTop: spacing.md,
		gap: spacing.xs,
		paddingBottom: spacing.lg,
	},
	insight: {
		...typography.caption,
	},
})
