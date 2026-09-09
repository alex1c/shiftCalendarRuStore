/**
 * Shared presentational UI primitives.
 */

import type { ReactNode } from 'react'
import {
	Pressable,
	StyleSheet,
	Text,
	View,
	type StyleProp,
	type ViewStyle,
} from 'react-native'

import {
	elevation,
	radius,
	spacing,
	touchTarget,
	typography,
	useTheme,
} from '@/src/theme'

type ButtonProps = {
	label: string
	onPress: () => void
	variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
	disabled?: boolean
	accessibilityLabel?: string
	style?: StyleProp<ViewStyle>
}

export function AppButton ({
	label,
	onPress,
	variant = 'primary',
	disabled = false,
	accessibilityLabel,
	style,
}: ButtonProps) {
	const { colors } = useTheme()
	const isPrimary = variant === 'primary'
	const isSecondary = variant === 'secondary'
	const isDanger = variant === 'danger'

	let backgroundColor = 'transparent'
	let borderColor = 'transparent'
	let borderWidth = 0
	let textColor = colors.textPrimary

	if (isPrimary) {
		backgroundColor = colors.primary
		textColor = '#FFFFFF'
	} else if (isSecondary) {
		backgroundColor = colors.surface
		borderColor = colors.border
		borderWidth = 1.5
	} else if (isDanger) {
		backgroundColor = colors.dangerMuted
		textColor = colors.danger
	}

	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={accessibilityLabel ?? label}
			disabled={disabled}
			onPress={onPress}
			style={({ pressed }) => [
				styles.buttonBase,
				{
					backgroundColor,
					borderColor,
					borderWidth,
					opacity: disabled ? 0.45 : pressed ? 0.9 : 1,
				},
				style,
			]}
		>
			<Text style={[styles.buttonLabel, { color: textColor }]}>
				{label}
			</Text>
		</Pressable>
	)
}

type CardProps = {
	children: ReactNode
	style?: StyleProp<ViewStyle>
}

export function SurfaceCard ({ children, style }: CardProps) {
	const { colors } = useTheme()
	return (
		<View
			style={[
				styles.card,
				{
					backgroundColor: colors.surface,
					borderColor: colors.border,
				},
				style,
			]}
		>
			{children}
		</View>
	)
}

type SecondaryLinkProps = {
	label: string
	onPress: () => void
}

/** Textual secondary navigation row. */
export function SecondaryLink ({ label, onPress }: SecondaryLinkProps) {
	const { colors } = useTheme()
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={label}
			onPress={onPress}
			style={({ pressed }) => [
				styles.secondaryLink,
				{
					backgroundColor: pressed
						? colors.surfaceMuted
						: 'transparent',
				},
			]}
		>
			<Text
				style={[styles.secondaryLabel, { color: colors.textPrimary }]}
			>
				{label}
			</Text>
			<Text style={{ color: colors.textTertiary, fontSize: 18 }}>
				›
			</Text>
		</Pressable>
	)
}

const styles = StyleSheet.create({
	buttonBase: {
		minHeight: touchTarget.min + 4,
		borderRadius: radius.md,
		alignItems: 'center',
		justifyContent: 'center',
		paddingHorizontal: spacing.lg,
	},
	buttonLabel: {
		...typography.bodyStrong,
	},
	card: {
		borderRadius: radius.lg,
		padding: spacing.lg,
		borderWidth: 1,
		...elevation.sm,
	},
	secondaryLink: {
		minHeight: touchTarget.min,
		paddingVertical: spacing.sm,
		paddingHorizontal: spacing.xs,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		borderRadius: radius.sm,
	},
	secondaryLabel: {
		...typography.body,
	},
})
