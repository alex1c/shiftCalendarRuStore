/**
 * More tab home — schedules, salary, notifications, learning, about.
 */

import { StyleSheet, Text, View } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'

import { Screen } from '@/src/components/Screen'
import { SecondaryLink, SurfaceCard } from '@/src/components/ui'
import type { MoreStackParamList } from '@/src/navigation/types'
import { spacing, typography, useTheme } from '@/src/theme'

type Props = NativeStackScreenProps<MoreStackParamList, 'MoreHome'>

export function MoreScreen ({ navigation }: Props) {
	const { colors } = useTheme()

	return (
		<Screen includeBottomSafeArea={false}>
			<Text style={[styles.title, { color: colors.textPrimary }]}>
				Ещё
			</Text>
			<SurfaceCard style={styles.card}>
				<View>
					<SecondaryLink
						label="Мои графики"
						onPress={() => navigation.navigate('MySchedules')}
					/>
					<SecondaryLink
						label="Мой график"
						onPress={() => navigation.navigate('MySchedule')}
					/>
					<SecondaryLink
						label="Оплата и зарплата"
						onPress={() => navigation.navigate('Salary')}
					/>
					<SecondaryLink
						label="Уведомления"
						onPress={() => navigation.navigate('Notifications')}
					/>
					<SecondaryLink
						label="Обучение"
						onPress={() => navigation.navigate('Learning')}
					/>
					<SecondaryLink
						label="О приложении"
						onPress={() => navigation.navigate('About')}
					/>
				</View>
			</SurfaceCard>
		</Screen>
	)
}

const styles = StyleSheet.create({
	title: {
		...typography.title,
		marginBottom: spacing.md,
	},
	card: {
		paddingVertical: spacing.xs,
	},
})
