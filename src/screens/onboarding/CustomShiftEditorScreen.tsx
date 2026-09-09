/**
 * Create or edit a custom shift type (name, short code, hours, break, color).
 */

import { useState } from 'react'
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import DateTimePicker, {
	type DateTimePickerEvent,
} from '@react-native-community/datetimepicker'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'

import { Screen } from '@/src/components/Screen'
import { AppButton, AppTextField } from '@/src/components/ui'
import {
	CUSTOM_SHIFT_COLOR_TOKENS,
	DEFAULT_CUSTOM_END_TIME,
	DEFAULT_CUSTOM_SHIFT_COLOR,
	DEFAULT_CUSTOM_START_TIME,
	MAX_SHIFT_NAME_LENGTH,
	MAX_SHORT_NAME_LENGTH,
	applyCustomShiftEdits,
	clockTimeToDate,
	createCustomShiftType,
	findShiftType,
	formatClockTimeFromDate,
} from '@/src/domain'
import { useOnboardingDraft } from '@/src/features/onboarding/OnboardingDraft'
import type { OnboardingStackParamList } from '@/src/navigation/types'
import {
	radius,
	shiftPalette,
	spacing,
	touchTarget,
	typography,
	useTheme,
} from '@/src/theme'

type Props = NativeStackScreenProps<
	OnboardingStackParamList,
	'CustomShiftEditor'
>
type TimeField = 'start' | 'end'

export function CustomShiftEditorScreen ({ navigation, route }: Props) {
	const { colors } = useTheme()
	const { draft, addCustomShift, updateShiftType, replaceAtWithCustom } =
		useOnboardingDraft()
	const { intent, shiftTypeId, cycleIndex } = route.params
	const existing =
		shiftTypeId != null
			? findShiftType(draft.shiftTypes, shiftTypeId)
			: undefined

	const [name, setName] = useState(existing?.name ?? '')
	const [shortName, setShortName] = useState(existing?.shortName ?? '')
	const [startTime, setStartTime] = useState(
		existing?.startTime ?? DEFAULT_CUSTOM_START_TIME,
	)
	const [endTime, setEndTime] = useState(
		existing?.endTime ?? DEFAULT_CUSTOM_END_TIME,
	)
	const [breakMinutes, setBreakMinutes] = useState(
		String(existing?.breakMinutes ?? 0),
	)
	const [color, setColor] = useState(
		existing?.color ?? DEFAULT_CUSTOM_SHIFT_COLOR,
	)
	const [error, setError] = useState<string | undefined>()
	const [picker, setPicker] = useState<TimeField | null>(null)

	const handlePickerChange = (
		event: DateTimePickerEvent,
		date?: Date,
	) => {
		if (Platform.OS === 'android') {
			setPicker(null)
		}
		if (event.type === 'dismissed' || !date) {
			return
		}
		const next = formatClockTimeFromDate(date)
		if (picker === 'start') {
			setStartTime(next)
		}
		if (picker === 'end') {
			setEndTime(next)
		}
	}

	const handleSave = () => {
		const input = {
			name,
			shortName,
			startTime,
			endTime,
			breakMinutes,
			color,
		}
		if (intent === 'edit' && existing) {
			const result = applyCustomShiftEdits(existing, input)
			if (!result.ok) {
				setError(result.message)
				return
			}
			updateShiftType(result.shift)
			navigation.goBack()
			return
		}
		const created = createCustomShiftType(input)
		if (!created.ok) {
			setError(created.message)
			return
		}
		if (intent === 'create-and-replace' && cycleIndex != null) {
			replaceAtWithCustom(cycleIndex, created.shift)
		} else {
			const added = addCustomShift(created.shift)
			if (!added.ok) {
				setError(added.message)
				return
			}
		}
		navigation.goBack()
	}

	return (
		<Screen>
			<Text style={[styles.title, { color: colors.textPrimary }]}>
				Своя смена
			</Text>
			<AppTextField
				label="Название"
				value={name}
				onChangeText={setName}
				maxLength={MAX_SHIFT_NAME_LENGTH}
				placeholder="Вечерняя"
			/>
			<View style={styles.gap} />
			<AppTextField
				label="Коротко"
				value={shortName}
				onChangeText={setShortName}
				maxLength={MAX_SHORT_NAME_LENGTH}
				autoCapitalize="characters"
				placeholder="Вч"
			/>
			<View style={styles.gap} />
			<Text style={[styles.label, { color: colors.textSecondary }]}>
				Время начала
			</Text>
			<AppButton
				label={startTime}
				variant="secondary"
				onPress={() => setPicker('start')}
			/>
			<View style={styles.gap} />
			<Text style={[styles.label, { color: colors.textSecondary }]}>
				Время окончания
			</Text>
			<AppButton
				label={endTime}
				variant="secondary"
				onPress={() => setPicker('end')}
			/>
			<View style={styles.gap} />
			<AppTextField
				label="Перерыв, минут"
				value={breakMinutes}
				onChangeText={setBreakMinutes}
				keyboardType="number-pad"
				placeholder="0"
			/>
			<View style={styles.gap} />
			<Text style={[styles.label, { color: colors.textSecondary }]}>
				Цвет
			</Text>
			<View style={styles.swatches}>
				{CUSTOM_SHIFT_COLOR_TOKENS.map((token) => {
					const palette = shiftPalette(token, colors)
					const selected = color === token
					return (
						<Pressable
							key={token}
							accessibilityRole="button"
							accessibilityState={{ selected }}
							accessibilityLabel={`Цвет ${token}`}
							onPress={() => setColor(token)}
							style={[
								styles.swatch,
								{
									backgroundColor: palette.background,
									borderColor: selected
										? colors.primary
										: colors.border,
								},
							]}
						>
							<Text style={{ color: palette.foreground }}>А</Text>
						</Pressable>
					)
				})}
			</View>
			{error ? (
				<Text style={[styles.error, { color: colors.danger }]}>
					{error}
				</Text>
			) : null}
			{picker ? (
				<DateTimePicker
					value={clockTimeToDate(
						picker === 'start' ? startTime : endTime,
					)}
					mode="time"
					is24Hour
					display={Platform.OS === 'ios' ? 'spinner' : 'default'}
					onChange={handlePickerChange}
				/>
			) : null}
			<View style={styles.footer}>
				<AppButton
					label="Отмена"
					variant="ghost"
					onPress={() => navigation.goBack()}
				/>
				<AppButton label="Сохранить" onPress={handleSave} />
			</View>
		</Screen>
	)
}

const styles = StyleSheet.create({
	title: {
		...typography.display,
		marginBottom: spacing.lg,
	},
	label: {
		...typography.label,
		marginBottom: spacing.xs,
	},
	gap: {
		height: spacing.md,
	},
	swatches: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: spacing.xs,
	},
	swatch: {
		width: touchTarget.min,
		height: touchTarget.min,
		borderRadius: radius.sm,
		borderWidth: 2,
		alignItems: 'center',
		justifyContent: 'center',
	},
	error: {
		...typography.caption,
		marginTop: spacing.md,
	},
	footer: {
		gap: spacing.sm,
		marginTop: spacing.lg,
	},
})
