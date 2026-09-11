/**
 * Today tab — effective shift, countdown, next/tomorrow, and quick actions.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AppState, StyleSheet, Text, View } from 'react-native'
import { useFocusEffect, useNavigation } from '@react-navigation/native'
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs'

import { ProfileSwitcher } from '@/src/components/ProfileSwitcher'
import { Screen } from '@/src/components/Screen'
import { AppButton, SurfaceCard } from '@/src/components/ui'
import { getTodayOverview } from '@/src/domain'
import { useAppBootstrap } from '@/src/features/bootstrap/AppBootstrap'
import type { MainTabParamList } from '@/src/navigation/types'
import {
	spacing,
	typography,
	useTheme,
} from '@/src/theme'

const REFRESH_MS = 60_000

export function TodayScreen () {
	const { colors } = useTheme()
	const navigation =
		useNavigation<BottomTabNavigationProp<MainTabParamList, 'Today'>>()
	const { schedule, overrides, clearDayOverride } = useAppBootstrap()
	const [now, setNow] = useState(() => new Date())

	const refreshNow = useCallback(() => {
		setNow(new Date())
	}, [])

	useFocusEffect(
		useCallback(() => {
			refreshNow()
		}, [refreshNow]),
	)

	useEffect(() => {
		const interval = setInterval(refreshNow, REFRESH_MS)
		const sub = AppState.addEventListener('change', (state) => {
			if (state === 'active') {
				refreshNow()
			}
		})
		return () => {
			clearInterval(interval)
			sub.remove()
		}
	}, [refreshNow])

	const overview = useMemo(() => {
		if (!schedule) {
			return null
		}
		return getTodayOverview(schedule, overrides, now)
	}, [schedule, overrides, now])

	if (!schedule || !overview) {
		return (
			<Screen includeBottomSafeArea={false}>
				<Text style={[styles.title, { color: colors.textPrimary }]}>
					Сначала создайте график
				</Text>
				<AppButton
					label="Создать график"
					onPress={() => {
						navigation.getParent()?.navigate('Onboarding' as never)
					}}
				/>
			</Screen>
		)
	}

	const handleOpenCalendar = () => {
		navigation.navigate('Calendar', {
			screen: 'CalendarHome',
			params: { focusDate: overview.todayDate },
		})
	}

	const handleEditToday = () => {
		navigation.navigate('Calendar', {
			screen: 'EditDay',
			params: { date: overview.todayDate },
		})
	}

	return (
		<Screen includeBottomSafeArea={false}>
			<View style={styles.switcherRow}>
				<ProfileSwitcher />
			</View>
			<SurfaceCard style={styles.hero}>
				<Text
					style={[styles.headline, { color: colors.textPrimary }]}
					accessibilityRole="header"
				>
					{overview.headline}
				</Text>
				{overview.hoursLine ? (
					<Text style={[styles.hours, { color: colors.textSecondary }]}>
						{overview.hoursLine}
					</Text>
				) : null}
				{overview.statusLine ? (
					<Text style={[styles.status, { color: colors.primary }]}>
						{overview.statusLine}
					</Text>
				) : null}
				{overview.completedMeta ? (
					<Text style={[styles.hours, { color: colors.textSecondary }]}>
						{overview.completedMeta}
					</Text>
				) : null}
				{overview.durationLine ? (
					<Text style={[styles.meta, { color: colors.textTertiary }]}>
						{overview.durationLine}
					</Text>
				) : null}
				{overview.breakLine ? (
					<Text style={[styles.meta, { color: colors.textTertiary }]}>
						{overview.breakLine}
					</Text>
				) : null}
			</SurfaceCard>

			<SurfaceCard style={styles.block}>
				<Text style={[styles.label, { color: colors.textTertiary }]}>
					Следующая смена
				</Text>
				{overview.nextEmptyMessage ? (
					<Text style={[styles.body, { color: colors.textPrimary }]}>
						{overview.nextEmptyMessage}
					</Text>
				) : (
					<>
						<Text style={[styles.bodyStrong, { color: colors.textPrimary }]}>
							{overview.nextWhen}
						</Text>
						<Text style={[styles.body, { color: colors.textSecondary }]}>
							{overview.nextTitle}
						</Text>
					</>
				)}
			</SurfaceCard>

			<SurfaceCard style={styles.compact}>
				<Text style={[styles.label, { color: colors.textTertiary }]}>
					Завтра
				</Text>
				<Text
					style={[styles.bodyStrong, { color: colors.textPrimary }]}
					numberOfLines={1}
				>
					{overview.tomorrowLine}
				</Text>
			</SurfaceCard>

			{overview.overtimeLine ? (
				<SurfaceCard style={styles.compact}>
					<Text style={[styles.label, { color: colors.textTertiary }]}>
						Переработка
					</Text>
					<Text style={[styles.bodyStrong, { color: colors.accent }]}>
						{overview.overtimeLine}
					</Text>
				</SurfaceCard>
			) : null}

			{overview.note ? (
				<SurfaceCard style={styles.block}>
					<Text style={[styles.label, { color: colors.textTertiary }]}>
						Заметка
					</Text>
					<Text style={[styles.body, { color: colors.textPrimary }]}>
						{overview.note}
					</Text>
				</SurfaceCard>
			) : null}

			<View style={styles.actions}>
				<AppButton
					label="Открыть в календаре"
					variant="secondary"
					onPress={handleOpenCalendar}
				/>
				<AppButton
					label="Изменить сегодня"
					onPress={handleEditToday}
				/>
				{overview.today.isOverridden ? (
					<AppButton
						label="Вернуть по графику"
						variant="ghost"
						onPress={() => {
							void clearDayOverride(overview.todayDate)
						}}
					/>
				) : null}
			</View>
		</Screen>
	)
}

const styles = StyleSheet.create({
	switcherRow: {
		marginBottom: spacing.sm,
	},
	title: {
		...typography.title,
		marginBottom: spacing.lg,
	},
	hero: {
		gap: spacing.xxs,
		marginBottom: spacing.sm,
		paddingVertical: spacing.md,
	},
	headline: {
		...typography.title,
	},
	hours: {
		...typography.subtitle,
	},
	status: {
		...typography.bodyStrong,
		marginTop: spacing.xxs,
	},
	meta: {
		...typography.caption,
	},
	block: {
		gap: 2,
		marginBottom: spacing.sm,
		paddingVertical: spacing.md,
	},
	compact: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		gap: spacing.sm,
		marginBottom: spacing.sm,
		paddingVertical: spacing.sm,
	},
	label: {
		...typography.label,
	},
	body: {
		...typography.body,
	},
	bodyStrong: {
		...typography.bodyStrong,
		flexShrink: 1,
	},
	actions: {
		gap: spacing.sm,
		marginTop: spacing.xs,
		paddingBottom: spacing.lg,
	},
})
