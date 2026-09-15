/**
 * Themed one-shot discovery hint dialog (not a toast spam surface).
 */

import { Modal, Pressable, StyleSheet, Text, View } from 'react-native'

import { AppButton, SurfaceCard } from '@/src/components/ui'
import { radius, spacing, typography, useTheme } from '@/src/theme'

type DiscoveryHintModalProps = {
	visible: boolean
	title: string
	body: string
	actionLabel?: string
	onDismiss: () => void
}

export function DiscoveryHintModal ({
	visible,
	title,
	body,
	actionLabel = 'Понятно',
	onDismiss,
}: DiscoveryHintModalProps) {
	const { colors } = useTheme()

	return (
		<Modal
			visible={visible}
			transparent
			animationType="fade"
			onRequestClose={onDismiss}
			statusBarTranslucent
		>
			<Pressable
				accessibilityRole="button"
				accessibilityLabel="Закрыть подсказку"
				onPress={onDismiss}
				style={[
					styles.backdrop,
					{ backgroundColor: colors.overlay },
				]}
			>
				<Pressable
					onPress={(event) => {
						event.stopPropagation()
					}}
					style={styles.sheet}
					accessibilityViewIsModal
				>
					<SurfaceCard style={styles.card}>
						<Text
							style={[styles.title, { color: colors.textPrimary }]}
							accessibilityRole="header"
						>
							{title}
						</Text>
						<Text
							style={[styles.body, { color: colors.textSecondary }]}
						>
							{body}
						</Text>
						<View style={styles.actions}>
							<AppButton
								label={actionLabel}
								onPress={onDismiss}
							/>
						</View>
					</SurfaceCard>
				</Pressable>
			</Pressable>
		</Modal>
	)
}

const styles = StyleSheet.create({
	backdrop: {
		flex: 1,
		justifyContent: 'center',
		paddingHorizontal: spacing.lg,
	},
	sheet: {
		width: '100%',
	},
	card: {
		borderRadius: radius.lg,
		gap: spacing.sm,
	},
	title: {
		...typography.subtitle,
	},
	body: {
		...typography.body,
	},
	actions: {
		marginTop: spacing.sm,
	},
})
