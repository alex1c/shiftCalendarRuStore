/**
 * Calendar tab stack — month view plus the one-day override editor.
 */

import { createNativeStackNavigator } from '@react-navigation/native-stack'

import { CalendarScreen } from '@/src/screens/CalendarScreen'
import { EditDayScreen } from '@/src/screens/EditDayScreen'
import { useTheme } from '@/src/theme'
import type { CalendarStackParamList } from './types'

const Stack = createNativeStackNavigator<CalendarStackParamList>()

export function CalendarNavigator () {
	const { colors } = useTheme()

	return (
		<Stack.Navigator
			screenOptions={{
				headerShown: false,
				contentStyle: { backgroundColor: colors.background },
			}}
		>
			<Stack.Screen name="CalendarHome" component={CalendarScreen} />
			<Stack.Screen name="EditDay" component={EditDayScreen} />
		</Stack.Navigator>
	)
}
