/**
 * Main calendar — cycle engine plus one-day overrides.
 */

import { useCallback, useMemo, useState } from 'react'
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useFocusEffect } from '@react-navigation/native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'

import { DayDetails } from '@/src/components/DayDetails'
import { MonthCalendar } from '@/src/components/MonthCalendar'
import { ProfileSwitcher } from '@/src/components/ProfileSwitcher'
import { Screen } from '@/src/components/Screen'
import { SurfaceCard } from '@/src/components/ui'
import { BannerAdSlot, useAds, useAdsProtectionFlag } from '@/src/ads'
import {
	ANALYTICS_EVENTS,
	trackEvent,
} from '@/src/analytics'
import {
	addMonths,
	buildMonthGrid,
	commonDaysOffInMonth,
	computeMonthStats,
	findNextWorkShift,
	formatCalendarDate,
	formatDayListInMonth,
	formatInMonth,
	formatMonthStats,
	formatMonthYear,
	formatNextWorkShift,
	formatShiftHours,
	formatTodaySummary,
	getEffectiveDay,
	parseCalendarDate,
	todayCalendarDate,
} from '@/src/domain'
import { createAndShareCalendarPdf } from '@/src/export'
import { useAppBootstrap } from '@/src/features/bootstrap/AppBootstrap'
import type { CalendarStackParamList } from '@/src/navigation/types'
import {
	radius,
	spacing,
	touchTarget,
	typography,
	useTheme,
} from '@/src/theme'

type Props = NativeStackScreenProps<CalendarStackParamList, 'CalendarHome'>

export function CalendarScreen ({ navigation, route }: Props) {
	const { colors } = useTheme()
	const { schedule, overrides, clearDayOverride, profiles, activeProfile } =
		useAppBootstrap()
	const { recordInteraction, requestInterstitial } = useAds()
	const today = todayCalendarDate()
	const todayParts = parseCalendarDate(today)

	const [visible, setVisible] = useState({
		year: todayParts.year,
		month: todayParts.month,
	})
	const [selectedDate, setSelectedDate] = useState(today)
	const [combined, setCombined] = useState(false)
	const [peerId, setPeerId] = useState<string | null>(null)
	const [sharingPdf, setSharingPdf] = useState(false)
	useAdsProtectionFlag(sharingPdf)

	const handleSelectDate = useCallback((date: string) => {
		const parts = parseCalendarDate(date)
		setSelectedDate(date)
		setVisible((current) => {
			if (parts.year === current.year && parts.month === current.month) {
				return current
			}
			return { year: parts.year, month: parts.month }
		})
	}, [])

	useFocusEffect(
		useCallback(() => {
			const focusDate = route.params?.focusDate
			if (!focusDate) {
				return
			}
			handleSelectDate(focusDate)
			navigation.setParams({ focusDate: undefined })
		}, [handleSelectDate, navigation, route.params?.focusDate]),
	)

	const cells = useMemo(
		() => buildMonthGrid(visible.year, visible.month),
		[visible.year, visible.month],
	)

	const daysByDate = useMemo(() => {
		if (!schedule) {
			return {}
		}
		return Object.fromEntries(
			cells.map((cell) => [
				cell.date,
				getEffectiveDay(schedule, cell.date, overrides),
			]),
		)
	}, [cells, schedule, overrides])

	const shiftsByDate = useMemo(
		() => Object.fromEntries(
			Object.entries(daysByDate).map(([date, day]) => [date, day.shift]),
		),
		[daysByDate],
	)

	const overriddenDates = useMemo(
		() => new Set(
			Object.values(daysByDate)
				.filter((day) => day.isOverridden)
				.map((day) => day.date),
		),
		[daysByDate],
	)

	const peers = useMemo(
		() => profiles.filter((item) => item.id !== activeProfile?.id),
		[profiles, activeProfile?.id],
	)
	const peerProfile = useMemo(() => {
		if (peers.length === 0) {
			return null
		}
		return peers.find((item) => item.id === peerId) ?? peers[0] ?? null
	}, [peers, peerId])
	const showCombined = combined && peerProfile != null && activeProfile != null

	const combinedByDate = useMemo(() => {
		if (!showCombined || !activeProfile || !peerProfile) {
			return undefined
		}
		const next: Record<string, { left: string; right: string }> = {}
		for (const cell of cells) {
			const left = getEffectiveDay(
				activeProfile.schedule,
				cell.date,
				activeProfile.overrides,
			)
			const right = getEffectiveDay(
				peerProfile.schedule,
				cell.date,
				peerProfile.overrides,
			)
			next[cell.date] = {
				left: left.shift.shortName,
				right: right.shift.shortName,
			}
		}
		return next
	}, [showCombined, activeProfile, peerProfile, cells])

	const commonOffDates = useMemo(() => {
		if (!showCombined || !activeProfile || !peerProfile) {
			return []
		}
		return commonDaysOffInMonth(
			activeProfile,
			peerProfile,
			visible.year,
			visible.month,
		)
	}, [showCombined, activeProfile, peerProfile, visible.year, visible.month])

	const selectedPeerDay = showCombined && peerProfile
		? getEffectiveDay(
			peerProfile.schedule,
			selectedDate,
			peerProfile.overrides,
		)
		: null

	const selectedDay = schedule
		? getEffectiveDay(schedule, selectedDate, overrides)
		: null
	const todayDay = schedule
		? getEffectiveDay(schedule, today, overrides)
		: null

	const monthStats = useMemo(() => {
		if (!schedule) {
			return null
		}
		return computeMonthStats(
			schedule,
			visible.year,
			visible.month,
			overrides,
		)
	}, [schedule, visible.year, visible.month, overrides])

	const nextShiftLabel = useMemo(() => {
		if (!schedule) {
			return null
		}
		return formatNextWorkShift(
			today,
			findNextWorkShift(schedule, today, overrides),
		)
	}, [schedule, today, overrides])

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

	const handleSelectToday = () => {
		setVisible({ year: todayParts.year, month: todayParts.month })
		setSelectedDate(today)
	}

	const handleEditDate = (date: string) => {
		handleSelectDate(date)
		navigation.navigate('EditDay', { date })
	}

	const handleSharePdf = useCallback(() => {
		if (sharingPdf || !activeProfile) {
			return
		}
		setSharingPdf(true)
		void (async () => {
			let shared = false
			try {
				const secondary =
					showCombined && peerProfile ? peerProfile : null
				await createAndShareCalendarPdf({
					year: visible.year,
					month: visible.month,
					primary: activeProfile,
					secondary,
					combined: secondary != null,
				})
				shared = true
				trackEvent(ANALYTICS_EVENTS.pdfShared)
				recordInteraction()
			} catch (error) {
				const message =
					error instanceof Error && error.message === 'SHARE_UNAVAILABLE'
						? 'Не удалось открыть меню «Поделиться»'
						: 'Не удалось создать PDF'
				Alert.alert('Поделиться', message)
			} finally {
				setSharingPdf(false)
			}
			if (shared) {
				// Wait until the PDF protection flag clears before evaluating policy.
				setTimeout(() => {
					void requestInterstitial('pdf_shared')
				}, 500)
			}
		})()
	}, [
		activeProfile,
		peerProfile,
		recordInteraction,
		requestInterstitial,
		sharingPdf,
		showCombined,
		visible.month,
		visible.year,
	])

	const handleSharePress = useCallback(() => {
		if (sharingPdf) {
			return
		}
		Alert.alert(
			'Поделиться графиком',
			'Выберите формат',
			[
				{
					text: 'PDF',
					onPress: () => {
						handleSharePdf()
					},
				},
				{ text: 'Отмена', style: 'cancel' },
			],
		)
	}, [handleSharePdf, sharingPdf])

	if (!schedule || !selectedDay || !todayDay) {
		return null
	}

	const todayHours = formatShiftHours(todayDay.shift)

	return (
		<Screen includeBottomSafeArea={false}>
			<View style={styles.switcherRow}>
				<ProfileSwitcher />
			</View>
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
				<HeaderIconButton
					icon="share-outline"
					accessibilityLabel="Поделиться"
					disabled={sharingPdf}
					onPress={handleSharePress}
				/>
			</View>
			{sharingPdf ? (
				<Text style={[styles.sharingHint, { color: colors.textSecondary }]}>
					Создаём PDF…
				</Text>
			) : null}
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

			{peers.length > 0 ? (
				<View style={styles.modeRow}>
					<Pressable
						accessibilityRole="button"
						accessibilityState={{ selected: !combined }}
						onPress={() => setCombined(false)}
						style={({ pressed }) => [
							styles.modeChip,
							{
								backgroundColor: !combined
									? colors.primaryMuted
									: colors.surface,
								borderColor: !combined
									? colors.primary
									: colors.border,
								opacity: pressed ? 0.85 : 1,
							},
						]}
					>
						<Text
							style={[
								styles.modeLabel,
								{
									color: !combined
										? colors.primary
										: colors.textPrimary,
								},
							]}
						>
							{activeProfile?.name ?? 'Я'}
						</Text>
					</Pressable>
					<Pressable
						accessibilityRole="button"
						accessibilityState={{ selected: combined }}
						onPress={() => setCombined(true)}
						style={({ pressed }) => [
							styles.modeChip,
							{
								backgroundColor: combined
									? colors.primaryMuted
									: colors.surface,
								borderColor: combined
									? colors.primary
									: colors.border,
								opacity: pressed ? 0.85 : 1,
							},
						]}
					>
						<Text
							style={[
								styles.modeLabel,
								{
									color: combined
										? colors.primary
										: colors.textPrimary,
								},
							]}
						>
							Совместный
						</Text>
					</Pressable>
				</View>
			) : null}

			{showCombined && peerProfile && activeProfile ? (
				<View style={styles.legend}>
					<Text style={[styles.legendItem, { color: colors.textSecondary }]}>
						● {activeProfile.name}
					</Text>
					<Text style={[styles.legendItem, { color: colors.textSecondary }]}>
						● {peerProfile.name}
					</Text>
				</View>
			) : null}

			{showCombined && peers.length > 1 ? (
				<View style={styles.modeRow}>
					{peers.map((item) => {
						const selected = item.id === peerProfile?.id
						return (
							<Pressable
								key={item.id}
								accessibilityRole="button"
								onPress={() => setPeerId(item.id)}
								style={[
									styles.modeChip,
									{
										backgroundColor: selected
											? colors.primaryMuted
											: colors.surface,
										borderColor: selected
											? colors.primary
											: colors.border,
									},
								]}
							>
								<Text
									style={[
										styles.modeLabel,
										{
											color: selected
												? colors.primary
												: colors.textPrimary,
										},
									]}
								>
									{item.name}
								</Text>
							</Pressable>
						)
					})}
				</View>
			) : null}

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
						{formatTodaySummary(todayDay.shift)}
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
				overriddenDates={overriddenDates}
				combinedByDate={combinedByDate}
				todayDate={today}
				selectedDate={selectedDate}
				onSelectDate={handleSelectDate}
				onEditDate={handleEditDate}
			/>

			<View style={styles.below}>
				{showCombined ? (
					<SurfaceCard style={styles.commonCard}>
						<Text
							style={[
								styles.commonTitle,
								{ color: colors.textPrimary },
							]}
						>
							{`Общие выходные ${formatInMonth(visible.month)}: ${commonOffDates.length}`}
						</Text>
						{commonOffDates.length > 0 ? (
							<Text
								style={[
									styles.commonList,
									{ color: colors.textSecondary },
								]}
							>
								{formatDayListInMonth(commonOffDates)}
							</Text>
						) : null}
					</SurfaceCard>
				) : null}
				{nextShiftLabel && !showCombined ? (
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
				<DayDetails
					day={selectedDay}
					onEdit={() => handleEditDate(selectedDate)}
					onRestore={
						selectedDay.isOverridden
							? () => {
								void clearDayOverride(selectedDate)
							}
							: undefined
					}
				/>
				{selectedPeerDay && peerProfile ? (
					<Text
						style={[styles.insight, { color: colors.textSecondary }]}
					>
						{`${peerProfile.name}: ${selectedPeerDay.shift.shortName} · ${selectedPeerDay.shift.name}`}
					</Text>
				) : null}
			</View>
			<BannerAdSlot placement="calendar" />
		</Screen>
	)
}

type HeaderIconButtonProps = {
	icon: 'chevron-back' | 'chevron-forward' | 'share-outline'
	accessibilityLabel: string
	onPress: () => void
	disabled?: boolean
}

function HeaderIconButton ({
	icon,
	accessibilityLabel,
	onPress,
	disabled = false,
}: HeaderIconButtonProps) {
	const { colors } = useTheme()
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={accessibilityLabel}
			disabled={disabled}
			onPress={onPress}
			hitSlop={4}
			style={({ pressed }) => [
				styles.headerButton,
				{
					backgroundColor: colors.surface,
					borderColor: colors.border,
					opacity: disabled ? 0.45 : pressed ? 0.85 : 1,
				},
			]}
		>
			<Ionicons name={icon} size={26} color={colors.primary} />
		</Pressable>
	)
}

const styles = StyleSheet.create({
	switcherRow: {
		marginBottom: spacing.sm,
	},
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
	sharingHint: {
		...typography.caption,
		textAlign: 'center',
		marginBottom: spacing.sm,
	},
	modeRow: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: spacing.xs,
		marginBottom: spacing.sm,
	},
	modeChip: {
		minHeight: touchTarget.min,
		paddingHorizontal: spacing.md,
		borderRadius: radius.md,
		borderWidth: 1.5,
		alignItems: 'center',
		justifyContent: 'center',
	},
	modeLabel: {
		...typography.bodyStrong,
	},
	legend: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: spacing.md,
		marginBottom: spacing.sm,
	},
	legendItem: {
		...typography.caption,
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
	commonCard: {
		gap: spacing.xxs,
		marginBottom: spacing.xs,
	},
	commonTitle: {
		...typography.bodyStrong,
	},
	commonList: {
		...typography.caption,
	},
})
