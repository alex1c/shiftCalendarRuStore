/**
 * Root stack — onboarding or main tabs, chosen from persisted schedule.
 */

import {
	DarkTheme,
	DefaultTheme,
	NavigationContainer,
} from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'

import { useAppBootstrap } from '@/src/features/bootstrap/AppBootstrap'
import { useTheme } from '@/src/theme'
import { MainTabNavigator } from './MainTabNavigator'
import { OnboardingNavigator } from './OnboardingNavigator'
import type { RootStackParamList } from './types'

const Stack = createNativeStackNavigator<RootStackParamList>()

export function RootNavigator () {
	const { colors, scheme } = useTheme()
	const { schedule } = useAppBootstrap()
	const hasSchedule = schedule != null

	const navTheme = {
		...(scheme === 'dark' ? DarkTheme : DefaultTheme),
		colors: {
			...(scheme === 'dark' ? DarkTheme.colors : DefaultTheme.colors),
			background: colors.background,
			card: colors.surface,
			text: colors.textPrimary,
			border: colors.border,
			primary: colors.primary,
		},
	}

	return (
		<NavigationContainer theme={navTheme}>
			<Stack.Navigator
				key={hasSchedule ? 'main' : 'onboarding'}
				initialRouteName={hasSchedule ? 'Main' : 'Onboarding'}
				screenOptions={{ headerShown: false }}
			>
				<Stack.Screen
					name="Onboarding"
					component={OnboardingNavigator}
				/>
				<Stack.Screen name="Main" component={MainTabNavigator} />
			</Stack.Navigator>
		</NavigationContainer>
	)
}
