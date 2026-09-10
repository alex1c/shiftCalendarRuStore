/**
 * Shared presentational UI primitives.
 */

import type { ReactNode } from 'react'
import {
	Pressable,
	StyleSheet,
	Switch,
	Text,
	TextInput,
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
	compact?: boolean
}

export function AppButton ({
	label,
	onPress,
	variant = 'primary',
	disabled = false,
	accessibilityLabel,
	style,
	compact = false,
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
				compact ? styles.buttonCompact : null,
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

type TextFieldProps = {
	label: string
	value: string
	onChangeText: (value: string) => void
	placeholder?: string
	error?: string
	maxLength?: number
	autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters'
	keyboardType?: 'default' | 'number-pad' | 'numeric' | 'decimal-pad'
	accessibilityLabel?: string
	multiline?: boolean
}

export function AppTextField ({
	label,
	value,
	onChangeText,
	placeholder,
	error,
	maxLength,
	autoCapitalize = 'sentences',
	keyboardType = 'default',
	accessibilityLabel,
	multiline = false,
}: TextFieldProps) {
	const { colors } = useTheme()
	return (
		<View>
			<Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
				{label}
			</Text>
			<TextInput
				accessibilityLabel={accessibilityLabel ?? label}
				value={value}
				onChangeText={onChangeText}
				placeholder={placeholder}
				placeholderTextColor={colors.textTertiary}
				maxLength={maxLength}
				autoCapitalize={autoCapitalize}
				autoCorrect={false}
				keyboardType={keyboardType}
				multiline={multiline}
				textAlignVertical={multiline ? 'top' : 'center'}
				style={[
					styles.fieldInput,
					multiline ? styles.fieldInputMultiline : null,
					{
						color: colors.textPrimary,
						backgroundColor: colors.surface,
						borderColor: error ? colors.danger : colors.border,
					},
				]}
			/>
			{error ? (
				<Text style={[styles.fieldError, { color: colors.danger }]}>
					{error}
				</Text>
			) : null}
		</View>
	)
}

type SwitchRowProps = {
	label: string
	value: boolean
	onValueChange: (value: boolean) => void
	accessibilityLabel?: string
}

/** Themed labelled switch used by optional salary extras. */
export function AppSwitchRow ({
	label,
	value,
	onValueChange,
	accessibilityLabel,
}: SwitchRowProps) {
	const { colors } = useTheme()
	return (
		<View style={styles.switchRow}>
			<Text
				style={[styles.switchLabel, { color: colors.textPrimary }]}
			>
				{label}
			</Text>
			<Switch
				accessibilityLabel={accessibilityLabel ?? label}
				value={value}
				onValueChange={onValueChange}
				trackColor={{
					false: colors.surfaceMuted,
					true: colors.primaryMuted,
				}}
				thumbColor={value ? colors.primary : colors.border}
			/>
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
	buttonCompact: {
		minHeight: touchTarget.min,
		paddingHorizontal: spacing.sm,
	},
	fieldLabel: {
		...typography.label,
		marginBottom: spacing.xxs,
	},
	fieldInput: {
		minHeight: touchTarget.min,
		borderWidth: 1,
		borderRadius: radius.sm,
		paddingHorizontal: spacing.sm,
		...typography.body,
	},
	fieldInputMultiline: {
		minHeight: 96,
		paddingVertical: spacing.sm,
	},
	fieldError: {
		...typography.caption,
		marginTop: spacing.xxs,
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
	switchRow: {
		minHeight: touchTarget.min,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		gap: spacing.sm,
	},
	switchLabel: {
		...typography.bodyStrong,
		flex: 1,
	},
})
