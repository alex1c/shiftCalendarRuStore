/**
 * More tab nested stack — schedule, learning, about.
 */

import { createNativeStackNavigator } from '@react-navigation/native-stack'

import { AboutScreen } from '@/src/screens/AboutScreen'
import { LearningScreen } from '@/src/screens/LearningScreen'
import { MoreScreen } from '@/src/screens/MoreScreen'
import { MyScheduleScreen } from '@/src/screens/MyScheduleScreen'
import { ProfilesScreen } from '@/src/screens/ProfilesScreen'
import { SalaryScreen } from '@/src/screens/SalaryScreen'
import { SalarySettingsScreen } from '@/src/screens/SalarySettingsScreen'
import { useTheme } from '@/src/theme'
import type { MoreStackParamList } from './types'

const Stack = createNativeStackNavigator<MoreStackParamList>()

export function MoreNavigator () {
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
				name="MoreHome"
				component={MoreScreen}
				options={{ headerShown: false }}
			/>
			<Stack.Screen
				name="MySchedules"
				component={ProfilesScreen}
				options={{ title: 'Мои графики' }}
			/>
			<Stack.Screen
				name="MySchedule"
				component={MyScheduleScreen}
				options={{ title: 'Мой график' }}
			/>
			<Stack.Screen
				name="Salary"
				component={SalaryScreen}
				options={{ title: 'Расчёт зарплаты' }}
			/>
			<Stack.Screen
				name="SalarySettings"
				component={SalarySettingsScreen}
				options={{ title: 'Настройки оплаты' }}
			/>
			<Stack.Screen
				name="Learning"
				component={LearningScreen}
				options={{ title: 'Обучение' }}
			/>
			<Stack.Screen
				name="About"
				component={AboutScreen}
				options={{ title: 'О приложении' }}
			/>
		</Stack.Navigator>
	)
}
