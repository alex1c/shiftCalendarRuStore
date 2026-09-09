/**
 * Onboarding stack: preset → start date → confirm.
 */

import { createNativeStackNavigator } from '@react-navigation/native-stack'

import { ConfirmScreen } from '@/src/screens/onboarding/ConfirmScreen'
import { CustomComingSoonScreen } from '@/src/screens/onboarding/CustomComingSoonScreen'
import { PresetSelectScreen } from '@/src/screens/onboarding/PresetSelectScreen'
import { StartDateScreen } from '@/src/screens/onboarding/StartDateScreen'
import { useTheme } from '@/src/theme'
import type { OnboardingStackParamList } from './types'

const Stack = createNativeStackNavigator<OnboardingStackParamList>()

export function OnboardingNavigator () {
	const { colors } = useTheme()

	return (
		<Stack.Navigator
			screenOptions={{
				headerStyle: { backgroundColor: colors.surface },
				headerTintColor: colors.primary,
				headerTitleStyle: { color: colors.textPrimary },
				contentStyle: { backgroundColor: colors.background },
				headerShadowVisible: false,
			}}
		>
			<Stack.Screen
				name="PresetSelect"
				component={PresetSelectScreen}
				options={{ headerShown: false }}
			/>
			<Stack.Screen
				name="CustomComingSoon"
				component={CustomComingSoonScreen}
				options={{ title: 'Свой график' }}
			/>
			<Stack.Screen
				name="StartDate"
				component={StartDateScreen}
				options={{ title: 'Начало цикла' }}
			/>
			<Stack.Screen
				name="Confirm"
				component={ConfirmScreen}
				options={{ title: 'Подтверждение' }}
			/>
		</Stack.Navigator>
	)
}
