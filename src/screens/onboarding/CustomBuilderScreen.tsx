/**
 * Custom cycle builder — quick-add sequence, reorder, and continue.
 */

import { Alert, Pressable, StyleSheet, Text, View } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'

import { CycleChips } from '@/src/components/CycleChips'
import { Screen } from '@/src/components/Screen'
import { AppButton, AppTextField, SurfaceCard } from '@/src/components/ui'
import {
	MAX_CYCLE_LENGTH,
	MAX_SCHEDULE_NAME_LENGTH,
	SHIFT_TYPE_DAY_ID,
	SHIFT_TYPE_NIGHT_ID,
	SHIFT_TYPE_OFF_ID,
	canAppendCycleItem,
	findShiftType,
	formatCycleLetters,
	formatShiftHours,
	validateCycleForSave,
} from '@/src/domain'
import { useOnboardingDraft } from '@/src/features/onboarding/OnboardingDraft'
import type { OnboardingStackParamList } from '@/src/navigation/types'
import {
	radius,
	shiftPalette,
	spacing,
	typography,
	useTheme,
} from '@/src/theme'

type Props = NativeStackScreenProps<OnboardingStackParamList, 'CustomBuilder'>

export function CustomBuilderScreen ({ navigation }: Props) {
	const { colors } = useTheme()
	const {
		draft,
		setName,
		addShift,
		removeAt,
		moveAt,
		duplicateAt,
	} = useOnboardingDraft()

	const saveCheck = validateCycleForSave(draft.cycle, draft.shiftTypes)
	const preview = formatCycleLetters(draft.cycle, draft.shiftTypes, ' ')

	const handleAdd = (shiftTypeId: string) => {
		const result = addShift(shiftTypeId)
		if (!result.ok) {
			Alert.alert('Цикл', result.message)
		}
	}

	const handleAddCustom = () => {
		const limit = canAppendCycleItem(draft.cycle.length)
		if (!limit.ok) {
			Alert.alert('Цикл', limit.message)
			return
		}
		navigation.navigate('CustomShiftEditor', {
			intent: 'create-and-add',
		})
	}

	const handleDuplicate = (index: number) => {
		const result = duplicateAt(index)
		if (!result.ok) {
			Alert.alert('Цикл', result.message)
		}
	}

	return (
		<Screen>
			<Text style={[styles.title, { color: colors.textPrimary }]}>
				Создайте свой цикл
			</Text>
			<Text style={[styles.subtitle, { color: colors.textSecondary }]}>
				Добавьте смены в том порядке, в котором они повторяются.
			</Text>

			<SurfaceCard style={styles.preview}>
				<Text
					style={[styles.previewMeta, { color: colors.textSecondary }]}
				>
					Цикл: {draft.cycle.length} {daysWord(draft.cycle.length)}
					{` · не больше ${MAX_CYCLE_LENGTH}`}
				</Text>
				<Text
					style={[styles.previewCycle, { color: colors.textPrimary }]}
				>
					{draft.cycle.length > 0 ? preview : 'Пока пусто'}
				</Text>
				{draft.cycle.length > 0 ? (
					<CycleChips
						cycle={draft.cycle}
						shiftTypes={draft.shiftTypes}
					/>
				) : null}
			</SurfaceCard>

			<View style={styles.quickAdd}>
				<AppButton
					label="+ День"
					variant="secondary"
					compact
					onPress={() => handleAdd(SHIFT_TYPE_DAY_ID)}
					style={styles.quickButton}
				/>
				<AppButton
					label="+ Ночь"
					variant="secondary"
					compact
					onPress={() => handleAdd(SHIFT_TYPE_NIGHT_ID)}
					style={styles.quickButton}
				/>
				<AppButton
					label="+ Выходной"
					variant="secondary"
					compact
					onPress={() => handleAdd(SHIFT_TYPE_OFF_ID)}
					style={styles.quickButton}
				/>
				<AppButton
					label="+ Своя смена"
					variant="secondary"
					compact
					onPress={handleAddCustom}
					style={styles.quickButton}
				/>
			</View>

			<View style={styles.list}>
				{draft.cycle.map((shiftId, index) => {
					const shift = findShiftType(draft.shiftTypes, shiftId)
					if (!shift) {
						return null
					}
					const palette = shiftPalette(shift.color, colors)
					const hours = formatShiftHours(shift)
					return (
						<SurfaceCard
							key={`${shiftId}-${index}`}
							style={styles.item}
						>
							<Pressable
								accessibilityRole="button"
								accessibilityLabel={`Изменить смену ${index + 1}, ${shift.name}`}
								onPress={() => {
									navigation.navigate('CycleItem', { index })
								}}
								style={styles.itemRow}
							>
								<View
									style={[
										styles.badge,
										{ backgroundColor: palette.background },
									]}
								>
									<Text
										style={[
											styles.badgeLetter,
											{ color: palette.foreground },
										]}
									>
										{shift.shortName}
									</Text>
								</View>
								<View style={styles.itemMeta}>
									<Text
										style={[
											styles.itemTitle,
											{ color: colors.textPrimary },
										]}
									>
										{`${index + 1}  ${shift.shortName}  ${shift.name}`}
									</Text>
									<Text
										style={[
											styles.itemHours,
											{ color: colors.textSecondary },
										]}
									>
										{hours ?? 'Без рабочего времени'}
									</Text>
								</View>
							</Pressable>
							<View style={styles.itemActions}>
								<AppButton
									label="←"
									accessibilityLabel="Сдвинуть влево"
									variant="secondary"
									compact
									onPress={() => moveAt(index, -1)}
									disabled={index === 0}
								/>
								<AppButton
									label="→"
									accessibilityLabel="Сдвинуть вправо"
									variant="secondary"
									compact
									onPress={() => moveAt(index, 1)}
									disabled={index === draft.cycle.length - 1}
								/>
								<AppButton
									label="Копия"
									accessibilityLabel="Дублировать"
									variant="secondary"
									compact
									onPress={() => handleDuplicate(index)}
								/>
								<AppButton
									label="Удалить"
									variant="danger"
									compact
									onPress={() => removeAt(index)}
								/>
							</View>
						</SurfaceCard>
					)
				})}
			</View>

			<AppTextField
				label="Название графика"
				value={draft.name}
				onChangeText={setName}
				maxLength={MAX_SCHEDULE_NAME_LENGTH}
				placeholder="Мой график"
			/>

			{!saveCheck.ok ? (
				<Text style={[styles.error, { color: colors.danger }]}>
					{saveCheck.message}
				</Text>
			) : null}

			<View style={styles.footer}>
				<AppButton
					label="Назад"
					variant="ghost"
					onPress={() => navigation.goBack()}
				/>
				<AppButton
					label="Продолжить"
					disabled={!saveCheck.ok}
					onPress={() => navigation.navigate('StartDate', {})}
				/>
			</View>
		</Screen>
	)
}

function daysWord (count: number): string {
	const mod10 = count % 10
	const mod100 = count % 100
	if (mod10 === 1 && mod100 !== 11) {
		return 'день'
	}
	if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
		return 'дня'
	}
	return 'дней'
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
	preview: {
		gap: spacing.sm,
		marginBottom: spacing.md,
	},
	previewMeta: {
		...typography.caption,
	},
	previewCycle: {
		...typography.subtitle,
	},
	quickAdd: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: spacing.xs,
		marginBottom: spacing.md,
	},
	quickButton: {
		flexGrow: 1,
	},
	list: {
		gap: spacing.sm,
		marginBottom: spacing.lg,
	},
	item: {
		gap: spacing.sm,
		padding: spacing.md,
	},
	itemRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: spacing.sm,
	},
	badge: {
		minWidth: 40,
		height: 40,
		borderRadius: radius.sm,
		alignItems: 'center',
		justifyContent: 'center',
		paddingHorizontal: spacing.xs,
	},
	badgeLetter: {
		...typography.subtitle,
	},
	itemMeta: {
		flex: 1,
		gap: 2,
	},
	itemTitle: {
		...typography.bodyStrong,
	},
	itemHours: {
		...typography.caption,
	},
	itemActions: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: spacing.xs,
	},
	error: {
		...typography.caption,
		marginTop: spacing.sm,
	},
	footer: {
		gap: spacing.sm,
		marginTop: spacing.lg,
		paddingBottom: spacing.xl,
	},
})
