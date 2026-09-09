/**
 * Root application entry — theme + bootstrap + navigation.
 */

import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import { AppBootstrapProvider } from '@/src/features/bootstrap/AppBootstrap'
import { RootNavigator } from '@/src/navigation'
import { ThemeProvider } from '@/src/theme'

export default function App () {
	return (
		<SafeAreaProvider>
			<ThemeProvider>
				<StatusBar style="auto" />
				<AppBootstrapProvider>
					<RootNavigator />
				</AppBootstrapProvider>
			</ThemeProvider>
		</SafeAreaProvider>
	)
}
