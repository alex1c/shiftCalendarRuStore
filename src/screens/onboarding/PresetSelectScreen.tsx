/**
 * First-run preset picker.
 */

import { Pressable, StyleSheet, Text, View } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'

import { PresetCard } from '@/src/components/PresetCard'
import { Screen } from '@/src/components/Screen'
import { SCHEDULE_PRESETS } from '@/src/domain'
import { useOnboardingDraft } from '@/src/features/onboarding/OnboardingDraft'
import type { OnboardingStackParamList } from '@/src/navigation/types'
import {
	elevation,
	radius,
	spacing,
	typography,
	useTheme,
} from '@/src/theme'

type Props = NativeStackScreenProps<
	OnboardingStackParamList,
	'PresetSelect'
>

export function PresetSelectScreen ({ navigation }: Props) {
	const { colors } = useTheme()
	const { resetDraft } = useOnboardingDraft()

	return (
		<Screen>
			<Text style={[styles.title, { color: colors.textPrimary }]}>
				Как вы работаете?
			</Text>
			<Text
				style={[styles.subtitle, { color: colors.textSecondary }]}
			>
				Выберите свой график. Его всегда можно изменить позже.
			</Text>

			<View style={styles.list}>
				{SCHEDULE_PRESETS.map((preset) => (
					<PresetCard
						key={preset.id}
						preset={preset}
						onPress={() => {
							navigation.navigate('StartDate', {
								presetId: preset.id,
							})
						}}
					/>
				))}

				<Pressable
					accessibilityRole="button"
					accessibilityLabel="Свой график"
					onPress={() => {
						resetDraft()
						navigation.navigate('CustomBuilder')
					}}
					style={({ pressed }) => [
						styles.customCard,
						{
							backgroundColor: colors.surface,
							borderColor: colors.border,
							opacity: pressed ? 0.92 : 1,
						},
					]}
				>
					<Text
						style={[
							styles.customTitle,
							{ color: colors.textPrimary },
						]}
					>
						Свой график
					</Text>
					<Text
						style={[
							styles.customBody,
							{ color: colors.textSecondary },
						]}
					>
						Собрать последовательность смен самостоятельно.
					</Text>
				</Pressable>
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
	list: {
		gap: spacing.sm,
		paddingBottom: spacing.xl,
	},
	customCard: {
		borderRadius: radius.lg,
		borderWidth: 1,
		padding: spacing.md,
		gap: spacing.xxs,
		...elevation.sm,
	},
	customTitle: {
		...typography.subtitle,
	},
	customBody: {
		...typography.caption,
	},
})
