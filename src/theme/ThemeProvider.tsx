/**
 * Theme context — follows the system light/dark scheme.
 */

import {
	createContext,
	useContext,
	useMemo,
	type ReactNode,
} from 'react'
import { useColorScheme } from 'react-native'

import {
	colors,
	type ColorSchemeName,
	type ThemeColors,
} from './tokens'

type ThemeContextValue = {
	scheme: ColorSchemeName
	colors: ThemeColors
}

const ThemeContext = createContext<ThemeContextValue>({
	scheme: 'light',
	colors: colors.light,
})

type ThemeProviderProps = {
	children: ReactNode
}

export function ThemeProvider ({ children }: ThemeProviderProps) {
	const systemScheme = useColorScheme()
	const value = useMemo(() => {
		const scheme: ColorSchemeName =
			systemScheme === 'dark' ? 'dark' : 'light'
		return {
			scheme,
			colors: colors[scheme],
		}
	}, [systemScheme])

	return (
		<ThemeContext.Provider value={value}>
			{children}
		</ThemeContext.Provider>
	)
}

export function useTheme (): ThemeContextValue {
	return useContext(ThemeContext)
}
