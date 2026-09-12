/**
 * Bottom tabs after onboarding. Calendar is the working Phase 1 surface.
 */

import { Ionicons } from '@expo/vector-icons'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'

import { useAds } from '@/src/ads'
import { StatsScreen } from '@/src/screens/StatsScreen'
import { TodayScreen } from '@/src/screens/TodayScreen'
import { useTheme } from '@/src/theme'
import { CalendarNavigator } from './CalendarNavigator'
import { MoreNavigator } from './MoreNavigator'
import type { MainTabParamList } from './types'

const Tab = createBottomTabNavigator<MainTabParamList>()

export function MainTabNavigator () {
	const { colors } = useTheme()
	const { recordInteraction } = useAds()

	return (
		<Tab.Navigator
			screenOptions={{
				headerShown: false,
				tabBarActiveTintColor: colors.primary,
				tabBarInactiveTintColor: colors.textTertiary,
				tabBarStyle: {
					backgroundColor: colors.tabBar,
					borderTopColor: colors.border,
					minHeight: 56,
				},
				tabBarItemStyle: {
					minHeight: 48,
				},
				tabBarLabelStyle: {
					fontSize: 12,
					fontWeight: '600',
				},
			}}
			screenListeners={{
				tabPress: () => {
					recordInteraction()
				},
			}}
		>
			<Tab.Screen
				name="Calendar"
				component={CalendarNavigator}
				options={{
					title: 'Календарь',
					tabBarIcon: ({ color, size }) => (
						<Ionicons
							name="calendar-outline"
							color={color}
							size={size}
						/>
					),
				}}
			/>
			<Tab.Screen
				name="Today"
				component={TodayScreen}
				options={{
					title: 'Сегодня',
					tabBarIcon: ({ color, size }) => (
						<Ionicons
							name="sunny-outline"
							color={color}
							size={size}
						/>
					),
				}}
			/>
			<Tab.Screen
				name="Stats"
				component={StatsScreen}
				options={{
					title: 'Статистика',
					tabBarIcon: ({ color, size }) => (
						<Ionicons
							name="bar-chart-outline"
							color={color}
							size={size}
						/>
					),
				}}
			/>
			<Tab.Screen
				name="More"
				component={MoreNavigator}
				options={{
					title: 'Ещё',
					tabBarIcon: ({ color, size }) => (
						<Ionicons
							name="ellipsis-horizontal-circle-outline"
							color={color}
							size={size}
						/>
					),
				}}
			/>
		</Tab.Navigator>
	)
}
