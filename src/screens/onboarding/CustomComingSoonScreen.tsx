/**
 * Informational stand-in for the Phase 2 custom cycle builder.
 */

import { StyleSheet, Text } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'

import { Screen } from '@/src/components/Screen'
import { AppButton } from '@/src/components/ui'
import type { OnboardingStackParamList } from '@/src/navigation/types'
import { spacing, typography, useTheme } from '@/src/theme'

type Props = NativeStackScreenProps<
	OnboardingStackParamList,
	'CustomComingSoon'
>

export function CustomComingSoonScreen ({ navigation }: Props) {
	const { colors } = useTheme()

	return (
		<Screen>
			<Text style={[styles.title, { color: colors.textPrimary }]}>
				Свой график
			</Text>
			<Text style={[styles.body, { color: colors.textSecondary }]}>
				Конструктор своего графика появится на следующем этапе.
			</Text>
			<AppButton
				label="Назад к пресетам"
				variant="secondary"
				onPress={() => navigation.goBack()}
				style={styles.button}
			/>
		</Screen>
	)
}

const styles = StyleSheet.create({
	title: {
		...typography.display,
		marginBottom: spacing.sm,
	},
	body: {
		...typography.body,
		marginBottom: spacing.lg,
	},
	button: {
		alignSelf: 'stretch',
	},
})
