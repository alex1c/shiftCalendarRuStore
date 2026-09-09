/**
 * Minimal about screen for Phase 1.
 */

import { StyleSheet, Text } from 'react-native'

import { Screen } from '@/src/components/Screen'
import { SurfaceCard } from '@/src/components/ui'
import { spacing, typography, useTheme } from '@/src/theme'

export function AboutScreen () {
	const { colors } = useTheme()

	return (
		<Screen includeBottomSafeArea={false}>
			<SurfaceCard>
				<Text style={[styles.name, { color: colors.textPrimary }]}>
					Календарь смен
				</Text>
				<Text
					style={[styles.meta, { color: colors.textSecondary }]}
				>
					Shift Calendar
				</Text>
				<Text
					style={[styles.meta, { color: colors.textSecondary }]}
				>
					Версия 1.0.0
				</Text>
				<Text
					style={[styles.body, { color: colors.textSecondary }]}
				>
					Офлайн-календарь рабочих графиков. Данные хранятся только
					на этом устройстве.
				</Text>
			</SurfaceCard>
		</Screen>
	)
}

const styles = StyleSheet.create({
	name: {
		...typography.title,
		marginBottom: spacing.xs,
	},
	meta: {
		...typography.caption,
		marginBottom: spacing.xxs,
	},
	body: {
		...typography.body,
		marginTop: spacing.md,
	},
})
