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
	createWorkScheduleFromCustom,
	createWorkScheduleFromPreset,
	formatCycleArrows,
	formatDayMonthYear,
	requireSchedulePreset,
	sanitizeScheduleName,
} from '@/src/domain'
import { useAppBootstrap } from '@/src/features/bootstrap/AppBootstrap'
import { useOnboardingDraft } from '@/src/features/onboarding/OnboardingDraft'
import type { OnboardingStackParamList } from '@/src/navigation/types'
import { spacing, typography, useTheme } from '@/src/theme'

type Props = NativeStackScreenProps<OnboardingStackParamList, 'Confirm'>

export function ConfirmScreen ({ navigation, route }: Props) {
	const { colors } = useTheme()
	const { persistSchedule, addProfile, profiles } = useAppBootstrap()
	const { draft, profileOwnerName } = useOnboardingDraft()
	const presetId = route.params.presetId
	const preset = presetId ? requireSchedulePreset(presetId) : null
	const isCustom = preset == null
	const cycle = preset?.cycle ?? draft.cycle
	const shiftTypes = preset ? DEFAULT_SHIFT_TYPES : draft.shiftTypes
	const displayName = preset
		? preset.name
		: sanitizeScheduleName(draft.name)
	const [saving, setSaving] = useState(false)

	const handleCreate = async () => {
		if (saving) {
			return
		}
		setSaving(true)
		try {
			const schedule = isCustom
				? createWorkScheduleFromCustom({
					name: draft.name,
					startDate: route.params.startDate,
					cycle: draft.cycle,
					shiftTypes: draft.shiftTypes,
				})
				: createWorkScheduleFromPreset({
					preset: preset!,
					startDate: route.params.startDate,
					shiftTypes: DEFAULT_SHIFT_TYPES,
				})
			if (profiles.length === 0) {
				await persistSchedule(schedule)
				navigation.getParent()?.dispatch(
					CommonActions.reset({
						index: 0,
						routes: [{ name: 'Main' }],
					}),
				)
			} else {
				await addProfile(profileOwnerName, schedule)
				navigation.getParent()?.goBack()
			}
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
					{displayName}
				</Text>
				{isCustom ? (
					<Text
						style={[styles.kind, { color: colors.textSecondary }]}
					>
						Свой график
					</Text>
				) : null}
				<Text
					style={[styles.cycle, { color: colors.textSecondary }]}
				>
					{formatCycleArrows(cycle, shiftTypes)}
				</Text>
				<CycleChips cycle={cycle} shiftTypes={shiftTypes} />
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
					label={profiles.length === 0 ? 'Создать календарь' : 'Добавить график'}
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
	kind: {
		...typography.caption,
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
