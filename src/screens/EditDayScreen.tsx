/**
 * Edit a single civil date without rewriting the repeating cycle.
 */

import { useMemo, useState } from 'react'
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import DateTimePicker, {
	type DateTimePickerEvent,
} from '@react-native-community/datetimepicker'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'

import { Screen } from '@/src/components/Screen'
import { AppButton, AppTextField } from '@/src/components/ui'
import {
	MAX_OVERRIDE_NOTE_LENGTH,
	MAX_SHIFT_NAME_LENGTH,
	MAX_SHORT_NAME_LENGTH,
	buildDayOverride,
	clockTimeToDate,
	defaultTimesForEditorKind,
	editorKindFromOverride,
	formatClockTimeFromDate,
	formatDayMonth,
	formatShiftTitle,
	getEffectiveDay,
	shiftTypeIdForEditorKind,
	validateDayOverride,
	type DayOverrideInput,
	type OverrideEditorKind,
} from '@/src/domain'
import { useAppBootstrap } from '@/src/features/bootstrap/AppBootstrap'
import type { CalendarStackParamList } from '@/src/navigation/types'
import {
	radius,
	spacing,
	touchTarget,
	typography,
	useTheme,
} from '@/src/theme'

type Props = NativeStackScreenProps<CalendarStackParamList, 'EditDay'>
type TimeField = 'start' | 'end'

const EDITOR_OPTIONS: { kind: OverrideEditorKind; label: string }[] = [
	{ kind: 'base', label: 'Оставить по графику' },
	{ kind: 'day', label: 'Дневная смена' },
	{ kind: 'night', label: 'Ночная смена' },
	{ kind: 'off', label: 'Выходной' },
	{ kind: 'vacation', label: 'Отпуск' },
	{ kind: 'sick', label: 'Больничный' },
	{ kind: 'dayOff', label: 'Отгул' },
	{ kind: 'extraShift', label: 'Доп. смена' },
	{ kind: 'overtime', label: 'Переработка' },
	{ kind: 'custom', label: 'Другое' },
]

export function EditDayScreen ({ navigation, route }: Props) {
	const { date } = route.params
	const { colors } = useTheme()
	const { schedule, overrides, persistDayOverride, clearDayOverride } =
		useAppBootstrap()

	const existing = overrides[date] ?? null
	const effective = schedule
		? getEffectiveDay(schedule, date, overrides)
		: null

	const initialKind = editorKindFromOverride(existing)
	const initialTimes = existing?.startTime && existing.endTime
		? { startTime: existing.startTime, endTime: existing.endTime }
		: defaultTimesForEditorKind(initialKind === 'base' ? 'day' : initialKind)

	const [kind, setKind] = useState<OverrideEditorKind>(initialKind)
	const [startTime, setStartTime] = useState(initialTimes.startTime)
	const [endTime, setEndTime] = useState(initialTimes.endTime)
	const [breakMinutes, setBreakMinutes] = useState(
		String(existing?.breakMinutes ?? 0),
	)
	const [overtimeHours, setOvertimeHours] = useState(
		String(Math.floor((existing?.overtimeMinutes ?? 60) / 60)),
	)
	const [overtimeMins, setOvertimeMins] = useState(
		String((existing?.overtimeMinutes ?? 60) % 60),
	)
	const [customName, setCustomName] = useState(existing?.customName ?? '')
	const [customShortName, setCustomShortName] = useState(
		existing?.customShortName ?? '',
	)
	const [customIsWork, setCustomIsWork] = useState(existing?.isWork !== false)
	const [note, setNote] = useState(existing?.note ?? '')
	const [error, setError] = useState<string | undefined>()
	const [picker, setPicker] = useState<TimeField | null>(null)

	const showTimes =
		kind === 'day' ||
		kind === 'night' ||
		kind === 'extraShift' ||
		(kind === 'custom' && customIsWork)

	const handleKind = (next: OverrideEditorKind) => {
		setKind(next)
		setError(undefined)
		if (next === 'day' || next === 'night' || next === 'extraShift') {
			const defaults = defaultTimesForEditorKind(next)
			if (!existing || editorKindFromOverride(existing) !== next) {
				setStartTime(defaults.startTime)
				setEndTime(defaults.endTime)
			}
		}
	}

	const handlePickerChange = (
		event: DateTimePickerEvent,
		picked?: Date,
	) => {
		if (Platform.OS === 'android') {
			setPicker(null)
		}
		if (event.type === 'dismissed' || !picked) {
			return
		}
		const next = formatClockTimeFromDate(picked)
		if (picker === 'start') {
			setStartTime(next)
		}
		if (picker === 'end') {
			setEndTime(next)
		}
	}

	const overtimeTotalMinutes = useMemo(() => {
		const hours = Number.parseInt(overtimeHours, 10)
		const minutes = Number.parseInt(overtimeMins, 10)
		const safeHours = Number.isFinite(hours) ? hours : 0
		const safeMins = Number.isFinite(minutes) ? minutes : 0
		return safeHours * 60 + safeMins
	}, [overtimeHours, overtimeMins])

	const handleRestore = async () => {
		await clearDayOverride(date)
		navigation.goBack()
	}

	const handleSave = async () => {
		if (kind === 'base') {
			await clearDayOverride(date)
			navigation.goBack()
			return
		}

		const type =
			kind === 'day' || kind === 'night' ? 'work' : kind
		const input: DayOverrideInput = {
			date,
			type,
			shiftTypeId: shiftTypeIdForEditorKind(kind),
			startTime,
			endTime,
			breakMinutes,
			overtimeMinutes: overtimeTotalMinutes,
			customName,
			customShortName,
			isWork: kind === 'custom' ? customIsWork : null,
			note,
		}
		const checked = validateDayOverride(input)
		if (!checked.ok) {
			setError(checked.message)
			return
		}
		const override = buildDayOverride(checked.value, existing)
		await persistDayOverride(override)
		navigation.goBack()
	}

	if (!schedule || !effective) {
		return null
	}

	return (
		<Screen>
			<Text style={[styles.title, { color: colors.textPrimary }]}>
				{formatDayMonth(date)}
			</Text>
			<Text style={[styles.subtitle, { color: colors.textSecondary }]}>
				{`По графику: ${formatShiftTitle(effective.baseShift)}`}
			</Text>

			<View style={styles.options}>
				{EDITOR_OPTIONS.map((option) => {
					const selected = kind === option.kind
					return (
						<Pressable
							key={option.kind}
							accessibilityRole="button"
							accessibilityState={{ selected }}
							onPress={() => handleKind(option.kind)}
							style={({ pressed }) => [
								styles.option,
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
									styles.optionLabel,
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

			{showTimes ? (
				<View style={styles.fields}>
					<Text style={[styles.label, { color: colors.textSecondary }]}>
						Время начала
					</Text>
					<AppButton
						label={startTime}
						variant="secondary"
						onPress={() => setPicker('start')}
					/>
					<Text style={[styles.label, { color: colors.textSecondary }]}>
						Время окончания
					</Text>
					<AppButton
						label={endTime}
						variant="secondary"
						onPress={() => setPicker('end')}
					/>
					<AppTextField
						label="Перерыв, минут"
						value={breakMinutes}
						onChangeText={setBreakMinutes}
						keyboardType="number-pad"
						placeholder="0"
					/>
				</View>
			) : null}

			{kind === 'overtime' ? (
				<View style={styles.fields}>
					<AppTextField
						label="Часы переработки"
						value={overtimeHours}
						onChangeText={setOvertimeHours}
						keyboardType="number-pad"
						placeholder="1"
					/>
					<AppTextField
						label="Минуты переработки"
						value={overtimeMins}
						onChangeText={setOvertimeMins}
						keyboardType="number-pad"
						placeholder="0"
					/>
				</View>
			) : null}

			{kind === 'custom' ? (
				<View style={styles.fields}>
					<AppTextField
						label="Название"
						value={customName}
						onChangeText={setCustomName}
						maxLength={MAX_SHIFT_NAME_LENGTH}
						placeholder="Подмена"
					/>
					<AppTextField
						label="Коротко"
						value={customShortName}
						onChangeText={setCustomShortName}
						maxLength={MAX_SHORT_NAME_LENGTH}
						autoCapitalize="characters"
						placeholder="ПД"
					/>
					<View style={styles.workRow}>
						<AppButton
							label="Рабочий день"
							variant={customIsWork ? 'primary' : 'secondary'}
							compact
							onPress={() => setCustomIsWork(true)}
							style={styles.workButton}
						/>
						<AppButton
							label="Нерабочий"
							variant={!customIsWork ? 'primary' : 'secondary'}
							compact
							onPress={() => setCustomIsWork(false)}
							style={styles.workButton}
						/>
					</View>
				</View>
			) : null}

			{kind !== 'base' ? (
				<View style={styles.fields}>
					<AppTextField
						label="Заметка"
						value={note}
						onChangeText={setNote}
						maxLength={MAX_OVERRIDE_NOTE_LENGTH}
						placeholder="Необязательно"
						multiline
					/>
				</View>
			) : null}

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
				<AppButton label="Сохранить" onPress={() => void handleSave()} />
				{existing ? (
					<AppButton
						label="Вернуть по графику"
						variant="secondary"
						onPress={() => void handleRestore()}
					/>
				) : null}
				<AppButton
					label="Отмена"
					variant="ghost"
					onPress={() => navigation.goBack()}
				/>
			</View>
		</Screen>
	)
}

const styles = StyleSheet.create({
	title: {
		...typography.display,
		marginBottom: spacing.xs,
	},
	subtitle: {
		...typography.body,
		marginBottom: spacing.lg,
	},
	options: {
		gap: spacing.xs,
		marginBottom: spacing.md,
	},
	option: {
		minHeight: touchTarget.min,
		borderRadius: radius.md,
		borderWidth: 1.5,
		paddingHorizontal: spacing.md,
		justifyContent: 'center',
	},
	optionLabel: {
		...typography.bodyStrong,
	},
	fields: {
		gap: spacing.sm,
		marginBottom: spacing.md,
	},
	label: {
		...typography.label,
	},
	workRow: {
		flexDirection: 'row',
		gap: spacing.xs,
	},
	workButton: {
		flex: 1,
	},
	error: {
		...typography.caption,
		marginBottom: spacing.md,
	},
	footer: {
		gap: spacing.sm,
		paddingBottom: spacing.xl,
	},
})
