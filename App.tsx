/**
 * Root application entry — theme + ads + analytics + bootstrap + navigation.
 */

import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import { AdsLifecycleBridge, AdsProvider } from '@/src/ads'
import { AnalyticsProvider } from '@/src/analytics'
import { AppBootstrapProvider } from '@/src/features/bootstrap/AppBootstrap'
import { RootNavigator } from '@/src/navigation'
import { ThemeProvider } from '@/src/theme'

export default function App () {
	return (
		<SafeAreaProvider>
			<ThemeProvider>
				<StatusBar style="auto" />
				<AdsProvider>
					<AnalyticsProvider>
						<AppBootstrapProvider>
							<AdsLifecycleBridge />
							<RootNavigator />
						</AppBootstrapProvider>
					</AnalyticsProvider>
				</AdsProvider>
			</ThemeProvider>
		</SafeAreaProvider>
	)
}
