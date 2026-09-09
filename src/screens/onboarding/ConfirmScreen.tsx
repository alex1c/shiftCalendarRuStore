/**
 * Final onboarding confirmation before persisting the schedule.
 */

import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { CommonActions } from '@react-navigation/native'

import { CycleChips } from '@/src/components/CycleChips'
import { Screen } from '@/src/components/Screen'
import { AppButton, SurfaceCard } from '@/src/components/ui'
import {
	DEFAULT_SHIFT_TYPES,
	createWorkScheduleFromPreset,
	formatCycleArrows,
	formatDayMonthYear,
	requireSchedulePreset,
} from '@/src/domain'
import { useAppBootstrap } from '@/src/features/bootstrap/AppBootstrap'
import type { OnboardingStackParamList } from '@/src/navigation/types'
import { spacing, typography, useTheme } from '@/src/theme'

type Props = NativeStackScreenProps<OnboardingStackParamList, 'Confirm'>

export function ConfirmScreen ({ navigation, route }: Props) {
	const { colors } = useTheme()
	const { persistSchedule } = useAppBootstrap()
	const preset = requireSchedulePreset(route.params.presetId)
	const [saving, setSaving] = useState(false)

	const handleCreate = async () => {
		if (saving) {
			return
		}
		setSaving(true)
		try {
			const schedule = createWorkScheduleFromPreset({
				preset,
				startDate: route.params.startDate,
				shiftTypes: DEFAULT_SHIFT_TYPES,
			})
			await persistSchedule(schedule)
			navigation.getParent()?.dispatch(
				CommonActions.reset({
					index: 0,
					routes: [{ name: 'Main' }],
				}),
			)
		} finally {
			setSaving(false)
		}
	}

	return (
		<Screen>
			<Text style={[styles.title, { color: colors.textPrimary }]}>
				Ваш график
			</Text>

			<SurfaceCard style={styles.card}>
				<Text style={[styles.name, { color: colors.textPrimary }]}>
					{preset.name}
				</Text>
				<Text
					style={[styles.cycle, { color: colors.textSecondary }]}
				>
					{formatCycleArrows(preset.cycle, DEFAULT_SHIFT_TYPES)}
				</Text>
				<CycleChips cycle={preset.cycle} />
				<Text style={[styles.start, { color: colors.textPrimary }]}>
					Начало цикла: {formatDayMonthYear(route.params.startDate)}
				</Text>
			</SurfaceCard>

			<View style={styles.actions}>
				<AppButton
					label="Назад"
					variant="ghost"
					onPress={() => navigation.goBack()}
					disabled={saving}
				/>
				<AppButton
					label="Создать календарь"
					onPress={() => {
						void handleCreate()
					}}
					disabled={saving}
				/>
			</View>
		</Screen>
	)
}

const styles = StyleSheet.create({
	title: {
		...typography.display,
		marginBottom: spacing.lg,
	},
	card: {
		gap: spacing.sm,
		marginBottom: spacing.lg,
	},
	name: {
		...typography.title,
	},
	cycle: {
		...typography.body,
	},
	start: {
		...typography.bodyStrong,
		marginTop: spacing.xs,
	},
	actions: {
		gap: spacing.sm,
	},
})
