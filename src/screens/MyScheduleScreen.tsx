/**
 * Saved schedule summary plus a confirmed reset back to onboarding.
 */

import { Alert, StyleSheet, Text, View } from 'react-native'
import { CommonActions } from '@react-navigation/native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'

import { CycleChips } from '@/src/components/CycleChips'
import { Screen } from '@/src/components/Screen'
import { AppButton, SurfaceCard } from '@/src/components/ui'
import {
	formatCycleArrows,
	formatCycleLetters,
	formatDayMonthYear,
	getSchedulePreset,
	isCustomSchedule,
} from '@/src/domain'
import { useAppBootstrap } from '@/src/features/bootstrap/AppBootstrap'
import type { MoreStackParamList } from '@/src/navigation/types'
import { spacing, typography, useTheme } from '@/src/theme'

type Props = NativeStackScreenProps<MoreStackParamList, 'MySchedule'>

export function MyScheduleScreen ({ navigation }: Props) {
	const { colors } = useTheme()
	const { schedule, resetSchedule } = useAppBootstrap()

	if (!schedule) {
		return null
	}

	const custom = isCustomSchedule(schedule)
	const preset = getSchedulePreset(schedule.presetId)
	const title = custom ? schedule.name : (preset?.name ?? schedule.name)

	const handleReset = () => {
		Alert.alert(
			'Сбросить график?',
			'Текущий график будет удалён. Вы сможете создать его заново.',
			[
				{ text: 'Отмена', style: 'cancel' },
				{
					text: 'Сбросить',
					style: 'destructive',
					onPress: () => {
						void (async () => {
							await resetSchedule()
							navigation.getParent()?.getParent()?.dispatch(
								CommonActions.reset({
									index: 0,
									routes: [{ name: 'Onboarding' }],
								}),
							)
						})()
					},
				},
			],
		)
	}

	return (
		<Screen includeBottomSafeArea={false}>
			<SurfaceCard style={styles.card}>
				<Text style={[styles.label, { color: colors.textTertiary }]}>
					График
				</Text>
				<Text style={[styles.value, { color: colors.textPrimary }]}>
					{title}
				</Text>
				{custom ? (
					<>
						<Text
							style={[
								styles.label,
								{ color: colors.textTertiary },
							]}
						>
							Тип
						</Text>
						<Text
							style={[styles.value, { color: colors.textPrimary }]}
						>
							Свой график
						</Text>
					</>
				) : null}
				<Text style={[styles.label, { color: colors.textTertiary }]}>
					Цикл
				</Text>
				<Text style={[styles.value, { color: colors.textPrimary }]}>
					{custom
						? formatCycleLetters(
							schedule.cycle,
							schedule.shiftTypes,
							' ',
						)
						: formatCycleArrows(
							schedule.cycle,
							schedule.shiftTypes,
						)}
				</Text>
				<CycleChips
					cycle={schedule.cycle}
					shiftTypes={schedule.shiftTypes}
				/>
				<Text style={[styles.label, { color: colors.textTertiary }]}>
					Начало
				</Text>
				<Text style={[styles.value, { color: colors.textPrimary }]}>
					{formatDayMonthYear(schedule.startDate)}
				</Text>
			</SurfaceCard>

			<View style={styles.reset}>
				<AppButton
					label="Сбросить график"
					variant="danger"
					onPress={handleReset}
				/>
			</View>
		</Screen>
	)
}

const styles = StyleSheet.create({
	card: {
		gap: spacing.sm,
	},
	label: {
		...typography.label,
		marginTop: spacing.xs,
	},
	value: {
		...typography.bodyStrong,
	},
	reset: {
		marginTop: spacing.lg,
	},
})
