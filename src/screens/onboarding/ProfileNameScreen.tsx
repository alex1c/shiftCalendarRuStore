/**
 * Name step when adding a secondary schedule profile.
 */

import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'

import { Screen } from '@/src/components/Screen'
import { AppButton, AppTextField } from '@/src/components/ui'
import {
	DEFAULT_SECONDARY_PROFILE_NAME,
	MAX_PROFILE_NAME_LENGTH,
	sanitizeProfileName,
} from '@/src/domain'
import { useOnboardingDraft } from '@/src/features/onboarding/OnboardingDraft'
import type { OnboardingStackParamList } from '@/src/navigation/types'
import { spacing, typography, useTheme } from '@/src/theme'

type Props = NativeStackScreenProps<OnboardingStackParamList, 'ProfileName'>

export function ProfileNameScreen ({ navigation }: Props) {
	const { colors } = useTheme()
	const { setProfileOwnerName } = useOnboardingDraft()
	const [name, setName] = useState(DEFAULT_SECONDARY_PROFILE_NAME)

	const handleNext = () => {
		const next = sanitizeProfileName(name, DEFAULT_SECONDARY_PROFILE_NAME)
		setProfileOwnerName(next)
		navigation.navigate('PresetSelect')
	}

	return (
		<Screen>
			<Text style={[styles.title, { color: colors.textPrimary }]}>
				Для кого этот график?
			</Text>
			<Text style={[styles.lead, { color: colors.textSecondary }]}>
				Например: Жена, Муж, Подработка, Работа 2.
			</Text>
			<AppTextField
				label="Название"
				value={name}
				onChangeText={setName}
				placeholder="Жена"
				maxLength={MAX_PROFILE_NAME_LENGTH}
			/>
			<View style={styles.actions}>
				<AppButton label="Далее" onPress={handleNext} />
			</View>
		</Screen>
	)
}

const styles = StyleSheet.create({
	title: {
		...typography.display,
		marginBottom: spacing.sm,
	},
	lead: {
		...typography.body,
		marginBottom: spacing.lg,
	},
	actions: {
		marginTop: spacing.lg,
		paddingBottom: spacing.xl,
	},
})
