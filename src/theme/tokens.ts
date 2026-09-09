/**
 * Design tokens for Shift Calendar.
 * Calm adult palette — high calendar contrast, no decorative gradients.
 */

export const spacing = {
	xxs: 4,
	xs: 8,
	sm: 12,
	md: 16,
	lg: 24,
	xl: 32,
	xxl: 48,
} as const

export const radius = {
	sm: 8,
	md: 12,
	lg: 16,
	xl: 20,
} as const

export const typography = {
	display: {
		fontSize: 28,
		lineHeight: 34,
		fontWeight: '700' as const,
	},
	title: {
		fontSize: 22,
		lineHeight: 28,
		fontWeight: '700' as const,
	},
	subtitle: {
		fontSize: 17,
		lineHeight: 24,
		fontWeight: '600' as const,
	},
	body: {
		fontSize: 16,
		lineHeight: 22,
		fontWeight: '400' as const,
	},
	bodyStrong: {
		fontSize: 16,
		lineHeight: 22,
		fontWeight: '600' as const,
	},
	caption: {
		fontSize: 14,
		lineHeight: 20,
		fontWeight: '500' as const,
	},
	label: {
		fontSize: 13,
		lineHeight: 16,
		fontWeight: '600' as const,
	},
	calendarDay: {
		fontSize: 15,
		lineHeight: 18,
		fontWeight: '600' as const,
	},
	calendarShift: {
		fontSize: 12,
		lineHeight: 16,
		fontWeight: '700' as const,
	},
} as const

export const elevation = {
	none: {
		shadowColor: 'transparent',
		shadowOffset: { width: 0, height: 0 },
		shadowOpacity: 0,
		shadowRadius: 0,
		elevation: 0,
	},
	sm: {
		shadowColor: '#1C1916',
		shadowOffset: { width: 0, height: 1 },
		shadowOpacity: 0.06,
		shadowRadius: 3,
		elevation: 1,
	},
	md: {
		shadowColor: '#1C1916',
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.1,
		shadowRadius: 8,
		elevation: 3,
	},
} as const

/**
 * Semantic colors. Shift chips stay readable in both schemes; letters
 * remain the primary distinguisher on the month grid.
 */
export const colors = {
	light: {
		background: '#F4F1EA',
		surface: '#FFFDF8',
		surfaceMuted: '#E8E2D6',
		border: '#D5CDBF',
		textPrimary: '#1C1916',
		textSecondary: '#5C564C',
		textTertiary: '#8A8378',
		primary: '#3F6B58',
		primaryPressed: '#335747',
		primaryMuted: '#DCE8E1',
		accent: '#B0792A',
		accentMuted: '#F4E6CF',
		warning: '#B0792A',
		warningMuted: '#F4E6CF',
		danger: '#B5524A',
		dangerMuted: '#F8E6E4',
		success: '#3F6B58',
		successMuted: '#DCE8E1',
		overlay: 'rgba(28, 25, 22, 0.45)',
		tabBar: '#FFFDF8',
		todayRing: '#3F6B58',
		shiftDayBg: '#F3E4C4',
		shiftDayFg: '#6F5310',
		shiftNightBg: '#D7E0EE',
		shiftNightFg: '#2E4568',
		shiftOffBg: '#E2E8E2',
		shiftOffFg: '#3F5346',
		shiftCustomBg: '#E8E2D6',
		shiftCustomFg: '#1C1916',
		shiftEveningBg: '#E8D7E4',
		shiftEveningFg: '#6B3A62',
		shiftMorningBg: '#D4E8E2',
		shiftMorningFg: '#1F5C52',
		shiftLateBg: '#D5D8EA',
		shiftLateFg: '#3A3F6B',
		shiftAccentBg: '#F0D6C8',
		shiftAccentFg: '#7A3E24',
	},
	dark: {
		background: '#161412',
		surface: '#221F1B',
		surfaceMuted: '#2C2823',
		border: '#3E3932',
		textPrimary: '#F4F0E8',
		textSecondary: '#B0A89C',
		textTertiary: '#7E776C',
		primary: '#8FBFAB',
		primaryPressed: '#6FA38D',
		primaryMuted: '#24352E',
		accent: '#D4A35A',
		accentMuted: '#3A2E18',
		warning: '#D4A35A',
		warningMuted: '#3A2E18',
		danger: '#E08A82',
		dangerMuted: '#3A2220',
		success: '#8FBFAB',
		successMuted: '#24352E',
		overlay: 'rgba(0, 0, 0, 0.55)',
		tabBar: '#1C1A17',
		todayRing: '#8FBFAB',
		shiftDayBg: '#3A3218',
		shiftDayFg: '#E6C97A',
		shiftNightBg: '#1E2A40',
		shiftNightFg: '#B4C7E4',
		shiftOffBg: '#243028',
		shiftOffFg: '#B4C9BA',
		shiftCustomBg: '#2C2823',
		shiftCustomFg: '#F4F0E8',
		shiftEveningBg: '#3A2436',
		shiftEveningFg: '#E6BFD8',
		shiftMorningBg: '#1C3330',
		shiftMorningFg: '#A8D4CB',
		shiftLateBg: '#24263A',
		shiftLateFg: '#C3C7E8',
		shiftAccentBg: '#3A261C',
		shiftAccentFg: '#E8C0A8',
	},
} as const

export type ColorSchemeName = 'light' | 'dark'

export type ThemeColors = {
	background: string
	surface: string
	surfaceMuted: string
	border: string
	textPrimary: string
	textSecondary: string
	textTertiary: string
	primary: string
	primaryPressed: string
	primaryMuted: string
	accent: string
	accentMuted: string
	warning: string
	warningMuted: string
	danger: string
	dangerMuted: string
	success: string
	successMuted: string
	overlay: string
	tabBar: string
	todayRing: string
	shiftDayBg: string
	shiftDayFg: string
	shiftNightBg: string
	shiftNightFg: string
	shiftOffBg: string
	shiftOffFg: string
	shiftCustomBg: string
	shiftCustomFg: string
	shiftEveningBg: string
	shiftEveningFg: string
	shiftMorningBg: string
	shiftMorningFg: string
	shiftLateBg: string
	shiftLateFg: string
	shiftAccentBg: string
	shiftAccentFg: string
}

/** Map a shift kind / color token to chip colors for the active scheme. */
export function shiftPalette (
	colorToken: string,
	themeColors: ThemeColors,
): { background: string; foreground: string } {
	switch (colorToken) {
		case 'night':
			return {
				background: themeColors.shiftNightBg,
				foreground: themeColors.shiftNightFg,
			}
		case 'off':
			return {
				background: themeColors.shiftOffBg,
				foreground: themeColors.shiftOffFg,
			}
		case 'custom':
			return {
				background: themeColors.shiftCustomBg,
				foreground: themeColors.shiftCustomFg,
			}
		case 'evening':
			return {
				background: themeColors.shiftEveningBg,
				foreground: themeColors.shiftEveningFg,
			}
		case 'morning':
			return {
				background: themeColors.shiftMorningBg,
				foreground: themeColors.shiftMorningFg,
			}
		case 'late':
			return {
				background: themeColors.shiftLateBg,
				foreground: themeColors.shiftLateFg,
			}
		case 'accent':
			return {
				background: themeColors.shiftAccentBg,
				foreground: themeColors.shiftAccentFg,
			}
		case 'day':
		default:
			return {
				background: themeColors.shiftDayBg,
				foreground: themeColors.shiftDayFg,
			}
	}
}

export const touchTarget = {
	min: 48,
} as const
