/**
 * Statistics tab — period totals over effective days (cycle + overrides).
 */

import { useCallback, useMemo, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useFocusEffect, useNavigation } from '@react-navigation/native'
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs'

import { Screen } from '@/src/components/Screen'
import { AppButton, SurfaceCard } from '@/src/components/ui'
import {
	STATS_PERIOD_OPTIONS,
	computePeriodStats,
	formatDayCount,
	formatStatsPeriodLabel,
	formatWorkHours,
	ruPlural,
	resolveStatsPeriod,
	type StatsPeriodKind,
} from '@/src/domain'
import { useAppBootstrap } from '@/src/features/bootstrap/AppBootstrap'
import type { MainTabParamList } from '@/src/navigation/types'
import {
	radius,
	spacing,
	touchTarget,
	typography,
	useTheme,
} from '@/src/theme'

export function StatsScreen () {
	const { colors } = useTheme()
	const navigation =
		useNavigation<BottomTabNavigationProp<MainTabParamList, 'Stats'>>()
	const { schedule, overrides } = useAppBootstrap()
	const [period, setPeriod] = useState<StatsPeriodKind>('30')
	const [now, setNow] = useState(() => new Date())

	useFocusEffect(
		useCallback(() => {
			setNow(new Date())
		}, []),
	)

	const range = useMemo(() => {
		if (!schedule) {
			return null
		}
		return resolveStatsPeriod(period, schedule.startDate, now)
	}, [schedule, period, now])

	const stats = useMemo(() => {
		if (!schedule || !range) {
			return null
		}
		return computePeriodStats(
			schedule,
			overrides,
			range.startDate,
			range.endDate,
		)
	}, [schedule, overrides, range])

	if (!schedule) {
		return (
			<Screen includeBottomSafeArea={false}>
				<Text style={[styles.title, { color: colors.textPrimary }]}>
					Сначала создайте график
				</Text>
			</Screen>
		)
	}

	if (!range || !stats) {
		return null
	}

	const periodLabel = formatStatsPeriodLabel(period, range)
	const shiftsWord = ruPlural(stats.workShifts, 'смена', 'смены', 'смен')
	const secondary = [
		stats.vacationDays > 0
			? { label: 'Отпуск', value: formatDayCount(stats.vacationDays) }
			: null,
		stats.sickDays > 0
			? { label: 'Больничный', value: formatDayCount(stats.sickDays) }
			: null,
		stats.dayOffDays > 0
			? { label: 'Отгул', value: formatDayCount(stats.dayOffDays) }
			: null,
		stats.extraShifts > 0
			? {
				label: 'Доп. смены',
				value: String(stats.extraShifts),
			}
			: null,
		stats.overtimeMinutes > 0
			? {
				label: 'Переработка',
				value: formatWorkHours(stats.overtimeMinutes),
			}
			: null,
	].filter((item): item is { label: string; value: string } => item != null)

	return (
		<Screen includeBottomSafeArea={false}>
			<Text
				style={[styles.title, { color: colors.textPrimary }]}
				accessibilityRole="header"
			>
				Статистика
			</Text>
			<View style={styles.chips}>
				{STATS_PERIOD_OPTIONS.map((option) => {
					const selected = period === option.kind
					return (
						<Pressable
							key={option.kind}
							accessibilityRole="button"
							accessibilityState={{ selected }}
							onPress={() => setPeriod(option.kind)}
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
			<Text style={[styles.range, { color: colors.textSecondary }]}>
				{periodLabel}
			</Text>

			<SurfaceCard style={styles.summary}>
				<Text style={[styles.summaryLabel, { color: colors.textTertiary }]}>
					За период
				</Text>
				<Text style={[styles.summaryShifts, { color: colors.textPrimary }]}>
					{`${stats.workShifts} ${shiftsWord}`}
				</Text>
				<Text style={[styles.summaryHours, { color: colors.primary }]}>
					{formatWorkHours(stats.workMinutes)}
				</Text>
			</SurfaceCard>

			<SurfaceCard style={styles.breakdown}>
				<BreakdownRow
					label="Дневные"
					value={String(stats.dayShifts)}
				/>
				<BreakdownRow
					label="Ночные"
					value={String(stats.nightShifts)}
				/>
				{stats.otherWorkShifts > 0 ? (
					<BreakdownRow
						label="Другие"
						value={String(stats.otherWorkShifts)}
					/>
				) : null}
				<BreakdownRow
					label="Выходные"
					value={String(stats.offDays)}
				/>
			</SurfaceCard>

			{secondary.length > 0 ? (
				<SurfaceCard style={styles.breakdown}>
					{secondary.map((item) => (
						<BreakdownRow
							key={item.label}
							label={item.label}
							value={item.value}
						/>
					))}
				</SurfaceCard>
			) : null}

			<View style={styles.footer}>
				<AppButton
					label="Открыть календарь"
					variant="secondary"
					onPress={() => {
						navigation.navigate('Calendar', {
							screen: 'CalendarHome',
						})
					}}
				/>
			</View>
		</Screen>
	)
}

type BreakdownRowProps = {
	label: string
	value: string
}

function BreakdownRow ({ label, value }: BreakdownRowProps) {
	const { colors } = useTheme()
	return (
		<View style={styles.row}>
			<Text style={[styles.rowLabel, { color: colors.textSecondary }]}>
				{label}
			</Text>
			<Text style={[styles.rowValue, { color: colors.textPrimary }]}>
				{value}
			</Text>
		</View>
	)
}

const styles = StyleSheet.create({
	title: {
		...typography.title,
		marginBottom: spacing.sm,
	},
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
	range: {
		...typography.caption,
		marginBottom: spacing.md,
	},
	summary: {
		gap: spacing.xxs,
		marginBottom: spacing.sm,
	},
	summaryLabel: {
		...typography.label,
	},
	summaryShifts: {
		...typography.display,
	},
	summaryHours: {
		...typography.subtitle,
	},
	breakdown: {
		gap: spacing.sm,
		marginBottom: spacing.sm,
	},
	row: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		gap: spacing.sm,
		minHeight: 28,
	},
	rowLabel: {
		...typography.body,
	},
	rowValue: {
		...typography.bodyStrong,
	},
	footer: {
		marginTop: spacing.sm,
		paddingBottom: spacing.lg,
	},
})
