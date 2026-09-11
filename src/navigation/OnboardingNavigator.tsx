/**
 * Onboarding stack: preset or custom builder → start date → confirm.
 * Also reused under AddProfile, starting at the profile-name step.
 */

import { createNativeStackNavigator } from '@react-navigation/native-stack'

import { OnboardingDraftProvider } from '@/src/features/onboarding/OnboardingDraft'
import { ConfirmScreen } from '@/src/screens/onboarding/ConfirmScreen'
import { CustomBuilderScreen } from '@/src/screens/onboarding/CustomBuilderScreen'
import { CustomShiftEditorScreen } from '@/src/screens/onboarding/CustomShiftEditorScreen'
import { CycleItemScreen } from '@/src/screens/onboarding/CycleItemScreen'
import { PresetSelectScreen } from '@/src/screens/onboarding/PresetSelectScreen'
import { ProfileNameScreen } from '@/src/screens/onboarding/ProfileNameScreen'
import { StartDateScreen } from '@/src/screens/onboarding/StartDateScreen'
import { useTheme } from '@/src/theme'
import type { OnboardingStackParamList } from './types'

const Stack = createNativeStackNavigator<OnboardingStackParamList>()

type OnboardingNavigatorProps = {
	initialRouteName?: keyof OnboardingStackParamList
}

export function OnboardingNavigator ({
	initialRouteName = 'PresetSelect',
}: OnboardingNavigatorProps) {
	const { colors } = useTheme()

	return (
		<OnboardingDraftProvider>
			<Stack.Navigator
				initialRouteName={initialRouteName}
				screenOptions={{
					headerStyle: { backgroundColor: colors.surface },
					headerTintColor: colors.primary,
					headerTitleStyle: { color: colors.textPrimary },
					contentStyle: { backgroundColor: colors.background },
					headerShadowVisible: false,
				}}
			>
				<Stack.Screen
					name="ProfileName"
					component={ProfileNameScreen}
					options={{ title: 'Новый график' }}
				/>
				<Stack.Screen
					name="PresetSelect"
					component={PresetSelectScreen}
					options={{
						headerShown: initialRouteName !== 'PresetSelect',
						title: 'График',
					}}
				/>
				<Stack.Screen
					name="CustomBuilder"
					component={CustomBuilderScreen}
					options={{ title: 'Свой график' }}
				/>
				<Stack.Screen
					name="CustomShiftEditor"
					component={CustomShiftEditorScreen}
					options={{ title: 'Своя смена' }}
				/>
				<Stack.Screen
					name="CycleItem"
					component={CycleItemScreen}
					options={{ title: 'Элемент цикла' }}
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
		</OnboardingDraftProvider>
	)
}

export function AddProfileNavigator () {
	return <OnboardingNavigator initialRouteName="ProfileName" />
}