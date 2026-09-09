/**
 * Reusable placeholder body for screens not yet built in this phase.
 */

import { StyleSheet, Text } from 'react-native'

import { Screen } from '@/src/components/Screen'
import { spacing, typography, useTheme } from '@/src/theme'

type PlaceholderScreenProps = {
	title: string
	description: string
}

export function PlaceholderBody ({
	title,
	description,
}: PlaceholderScreenProps) {
	const { colors } = useTheme()
	return (
		<Screen includeBottomSafeArea={false}>
			<Text style={[styles.title, { color: colors.textPrimary }]}>
				{title}
			</Text>
			<Text style={[styles.body, { color: colors.textSecondary }]}>
				{description}
			</Text>
		</Screen>
	)
}

const styles = StyleSheet.create({
	title: {
		...typography.title,
		marginBottom: spacing.sm,
	},
	body: {
		...typography.body,
	},
})
