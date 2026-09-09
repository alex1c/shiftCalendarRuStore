/**
 * Main calendar — current month derived from the saved cycle.
 */

import { useMemo, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { DayDetails } from '@/src/components/DayDetails'
import { MonthCalendar } from '@/src/components/MonthCalendar'
import { Screen } from '@/src/components/Screen'
import {
	addMonths,
	buildMonthGrid,
	formatCalendarDate,
	formatMonthYear,
	parseCalendarDate,
	resolveShiftForDate,
	todayCalendarDate,
} from '@/src/domain'
import { useAppBootstrap } from '@/src/features/bootstrap/AppBootstrap'
import {
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

	if (!schedule || !selectedShift) {
		return null
	}

	return (
		<Screen scroll={false} includeBottomSafeArea={false}>
			<View style={styles.header}>
				<Text style={[styles.title, { color: colors.textPrimary }]}>
					{formatMonthYear(visible.year, visible.month)}
				</Text>
				<View style={styles.nav}>
					<HeaderButton
						label="‹"
						accessibilityLabel="Предыдущий месяц"
						onPress={() => goToMonth(-1)}
					/>
					<HeaderButton
						label="Сегодня"
						accessibilityLabel="Вернуться к текущему месяцу"
						onPress={handleSelectToday}
						disabled={isCurrentMonth && selectedDate === today}
					/>
					<HeaderButton
						label="›"
						accessibilityLabel="Следующий месяц"
						onPress={() => goToMonth(1)}
					/>
				</View>
			</View>

			<MonthCalendar
				cells={cells}
				shiftsByDate={shiftsByDate}
				todayDate={today}
				selectedDate={selectedDate}
				onSelectDate={handleSelectDate}
			/>

			<View style={styles.details}>
				<DayDetails date={selectedDate} shift={selectedShift} />
			</View>
		</Screen>
	)
}

type HeaderButtonProps = {
	label: string
	accessibilityLabel: string
	onPress: () => void
	disabled?: boolean
}

function HeaderButton ({
	label,
	accessibilityLabel,
	onPress,
	disabled = false,
}: HeaderButtonProps) {
	const { colors } = useTheme()
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={accessibilityLabel}
			disabled={disabled}
			onPress={onPress}
			style={({ pressed }) => [
				styles.headerButton,
				{
					backgroundColor: colors.surface,
					borderColor: colors.border,
					opacity: disabled ? 0.4 : pressed ? 0.85 : 1,
				},
			]}
		>
			<Text
				style={[styles.headerButtonLabel, { color: colors.primary }]}
			>
				{label}
			</Text>
		</Pressable>
	)
}

const styles = StyleSheet.create({
	header: {
		marginBottom: spacing.sm,
		gap: spacing.sm,
	},
	title: {
		...typography.title,
	},
	nav: {
		flexDirection: 'row',
		gap: spacing.xs,
	},
	headerButton: {
		minHeight: touchTarget.min,
		minWidth: touchTarget.min,
		paddingHorizontal: spacing.sm,
		borderRadius: 10,
		borderWidth: 1,
		alignItems: 'center',
		justifyContent: 'center',
	},
	headerButtonLabel: {
		...typography.bodyStrong,
	},
	details: {
		marginTop: spacing.md,
	},
})
