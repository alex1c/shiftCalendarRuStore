/**
 * Safe-area screen shell with themed background.
 * Optional `footer` renders outside the ScrollView so sticky banners stay
 * pinned above the tab bar instead of scrolling off-screen.
 */

import type { ReactNode } from 'react'
import {
	Platform,
	ScrollView,
	StyleSheet,
	View,
	type StyleProp,
	type ViewStyle,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { spacing, useTheme } from '@/src/theme'

type ScreenProps = {
	children: ReactNode
	/**
	 * Pinned below scrollable content (full-bleed). Use for sticky banners
	 * that must remain visible above the tab bar.
	 */
	footer?: ReactNode
	scroll?: boolean
	/** When false, skip extra bottom inset (tab screens already have a bar). */
	includeBottomSafeArea?: boolean
	style?: StyleProp<ViewStyle>
	contentStyle?: StyleProp<ViewStyle>
}

export function Screen ({
	children,
	footer,
	scroll = true,
	includeBottomSafeArea = true,
	style,
	contentStyle,
}: ScreenProps) {
	const insets = useSafeAreaInsets()
	const { colors } = useTheme()
	// On Android 15+ edge-to-edge gesture navigation can report a zero
	// navigation-bar inset while the translucent system surface still covers
	// the bottom of the window. Keep owned scroll content comfortably clear of
	// that surface without changing tab screens that delegate it to the tab bar.
	const bottomSafeBuffer = Platform.OS === 'android' ? spacing.xl : 0
	const padding = {
		paddingTop: insets.top + spacing.md,
		paddingBottom: includeBottomSafeArea
			? Math.max(insets.bottom, bottomSafeBuffer) + spacing.lg
			: spacing.md,
		paddingHorizontal: spacing.lg,
	}

	const body = scroll ? (
		<ScrollView
			style={styles.flex}
			contentContainerStyle={[padding, contentStyle]}
			keyboardShouldPersistTaps="handled"
		>
			{children}
		</ScrollView>
	) : (
		<View style={[styles.flex, padding, contentStyle]}>{children}</View>
	)

	if (!footer) {
		return (
			<View
				style={[
					styles.flex,
					{ backgroundColor: colors.background },
					style,
				]}
			>
				{body}
			</View>
		)
	}

	return (
		<View
			style={[
				styles.flex,
				{ backgroundColor: colors.background },
				style,
			]}
		>
			<View style={styles.flex}>{body}</View>
			{/* Full-bleed footer — no horizontal padding so sticky ads can span width. */}
			<View style={styles.footer}>{footer}</View>
		</View>
	)
}

const styles = StyleSheet.create({
	flex: {
		flex: 1,
	},
	footer: {
		width: '100%',
	},
})
