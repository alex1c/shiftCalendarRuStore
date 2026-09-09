/**
 * Cycle start-date picker. Default is today; the chosen date is always visible.
 */

import { useState } from 'react'
import { Platform, StyleSheet, Text, View } from 'react-native'
import DateTimePicker, {
	type DateTimePickerEvent,
} from '@react-native-community/datetimepicker'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'

import { Screen } from '@/src/components/Screen'
import { AppButton, SurfaceCard } from '@/src/components/ui'
import {
	DEFAULT_SHIFT_TYPES,
	calendarDateFromDate,
	calendarDateToLocalDate,
	formatDayMonthYear,
	getStartDateHint,
	requireSchedulePreset,
	todayCalendarDate,
} from '@/src/domain'
import type { OnboardingStackParamList } from '@/src/navigation/types'
import { spacing, typography, useTheme } from '@/src/theme'

type Props = NativeStackScreenProps<OnboardingStackParamList, 'StartDate'>

export function StartDateScreen ({ navigation, route }: Props) {
	const { colors } = useTheme()
	const preset = requireSchedulePreset(route.params.presetId)
	const [startDate, setStartDate] = useState(todayCalendarDate)
	const [showPicker, setShowPicker] = useState(false)

	const handlePickerChange = (
		event: DateTimePickerEvent,
		date?: Date,
	) => {
		if (Platform.OS === 'android') {
			setShowPicker(false)
		}
		if (event.type === 'dismissed' || !date) {
			return
		}
		setStartDate(calendarDateFromDate(date))
	}

	return (
		<Screen>
			<Text style={[styles.title, { color: colors.textPrimary }]}>
				Когда начинается ваш цикл?
			</Text>
			<Text
				style={[styles.subtitle, { color: colors.textSecondary }]}
			>
				Выберите день, который соответствует первому элементу
				выбранного цикла.
			</Text>

			<SurfaceCard style={styles.card}>
				<Text
					style={[styles.hint, { color: colors.textSecondary }]}
				>
					{getStartDateHint(preset, DEFAULT_SHIFT_TYPES)}
				</Text>
				<Text
					style={[styles.selected, { color: colors.textPrimary }]}
				>
					{formatDayMonthYear(startDate)}
				</Text>
				<AppButton
					label="Изменить дату"
					variant="secondary"
					onPress={() => setShowPicker(true)}
				/>
			</SurfaceCard>

			{showPicker ? (
				<DateTimePicker
					value={calendarDateToLocalDate(startDate)}
					mode="date"
					display={Platform.OS === 'ios' ? 'spinner' : 'default'}
					onChange={handlePickerChange}
				/>
			) : null}

			<View style={styles.actions}>
				<AppButton
					label="Назад"
					variant="ghost"
					onPress={() => navigation.goBack()}
				/>
				<AppButton
					label="Далее"
					onPress={() => {
						navigation.navigate('Confirm', {
							presetId: preset.id,
							startDate,
						})
					}}
				/>
			</View>
		</Screen>
	)
}

const styles = StyleSheet.create({
	title: {
		...typography.display,
		marginBottom: spacing.sm,
	},
	subtitle: {
		...typography.body,
		marginBottom: spacing.lg,
	},
	card: {
		gap: spacing.md,
		marginBottom: spacing.lg,
	},
	hint: {
		...typography.caption,
	},
	selected: {
		...typography.title,
	},
	actions: {
		gap: spacing.sm,
	},
})
