/**
 * Edit one cycle item: replace type, edit custom params, delete.
 */

import { Alert, StyleSheet, Text, View } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'

import { Screen } from '@/src/components/Screen'
import { AppButton, SurfaceCard } from '@/src/components/ui'
import {
	SHIFT_TYPE_DAY_ID,
	SHIFT_TYPE_NIGHT_ID,
	SHIFT_TYPE_OFF_ID,
	findShiftType,
	formatShiftHours,
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

type Props = NativeStackScreenProps<OnboardingStackParamList, 'CycleItem'>

export function CycleItemScreen ({ navigation, route }: Props) {
	const { colors } = useTheme()
	const { draft, replaceAt, removeAt } = useOnboardingDraft()
	const { index } = route.params
	const shiftId = draft.cycle[index]
	const shift = shiftId
		? findShiftType(draft.shiftTypes, shiftId)
		: undefined

	if (!shift) {
		return (
			<Screen>
				<Text style={{ color: colors.textSecondary }}>
					Смена уже удалена.
				</Text>
				<AppButton
					label="Назад"
					variant="ghost"
					onPress={() => navigation.goBack()}
				/>
			</Screen>
		)
	}

	const palette = shiftPalette(shift.color, colors)
	const hours = formatShiftHours(shift)

	const replaceWith = (nextId: string) => {
		replaceAt(index, nextId)
		navigation.goBack()
	}

	const handleDelete = () => {
		removeAt(index)
		navigation.goBack()
	}

	const handleReplaceCustom = () => {
		navigation.navigate('CustomShiftEditor', {
			intent: 'create-and-replace',
			cycleIndex: index,
		})
	}

	return (
		<Screen>
			<Text style={[styles.title, { color: colors.textPrimary }]}>
				{`Смена ${index + 1}`}
			</Text>
			<SurfaceCard style={styles.card}>
				<View
					style={[
						styles.badge,
						{ backgroundColor: palette.background },
					]}
				>
					<Text
						style={[styles.badgeLetter, { color: palette.foreground }]}
					>
						{shift.shortName}
					</Text>
				</View>
				<Text style={[styles.name, { color: colors.textPrimary }]}>
					{shift.name}
				</Text>
				<Text style={[styles.hours, { color: colors.textSecondary }]}>
					{hours ?? 'Без рабочего времени'}
				</Text>
			</SurfaceCard>

			<Text style={[styles.section, { color: colors.textSecondary }]}>
				Заменить на
			</Text>
			<View style={styles.row}>
				<AppButton
					label="Дневная"
					variant="secondary"
					compact
					onPress={() => replaceWith(SHIFT_TYPE_DAY_ID)}
					style={styles.flex}
				/>
				<AppButton
					label="Ночная"
					variant="secondary"
					compact
					onPress={() => replaceWith(SHIFT_TYPE_NIGHT_ID)}
					style={styles.flex}
				/>
			</View>
			<View style={styles.row}>
				<AppButton
					label="Выходной"
					variant="secondary"
					compact
					onPress={() => replaceWith(SHIFT_TYPE_OFF_ID)}
					style={styles.flex}
				/>
				<AppButton
					label="Своя смена"
					variant="secondary"
					compact
					onPress={handleReplaceCustom}
					style={styles.flex}
				/>
			</View>

			{shift.kind === 'custom' ? (
				<AppButton
					label="Изменить параметры"
					variant="secondary"
					onPress={() => {
						navigation.navigate('CustomShiftEditor', {
							intent: 'edit',
							shiftTypeId: shift.id,
						})
					}}
					style={styles.block}
				/>
			) : null}

			<AppButton
				label="Удалить элемент"
				variant="danger"
				onPress={() => {
					Alert.alert(
						'Удалить смену?',
						'Элемент будет убран из цикла.',
						[
							{ text: 'Отмена', style: 'cancel' },
							{
								text: 'Удалить',
								style: 'destructive',
								onPress: handleDelete,
							},
						],
					)
				}}
				style={styles.block}
			/>
			<AppButton
				label="Назад"
				variant="ghost"
				onPress={() => navigation.goBack()}
			/>
		</Screen>
	)
}

const styles = StyleSheet.create({
	title: {
		...typography.display,
		marginBottom: spacing.lg,
	},
	card: {
		alignItems: 'flex-start',
		gap: spacing.xs,
		marginBottom: spacing.lg,
	},
	badge: {
		minWidth: 48,
		height: 48,
		borderRadius: radius.sm,
		alignItems: 'center',
		justifyContent: 'center',
		paddingHorizontal: spacing.sm,
	},
	badgeLetter: {
		...typography.title,
	},
	name: {
		...typography.subtitle,
	},
	hours: {
		...typography.caption,
	},
	section: {
		...typography.label,
		marginBottom: spacing.sm,
	},
	row: {
		flexDirection: 'row',
		gap: spacing.xs,
		marginBottom: spacing.xs,
	},
	flex: {
		flex: 1,
	},
	block: {
		marginTop: spacing.md,
	},
})
