/**
 * AppMetrica configuration — never invent an API key.
 * When the key is missing, analytics stays a no-op.
 */

import Constants from 'expo-constants'

/**
 * Optional key sources (first non-empty wins):
 * 1. EXPO_PUBLIC_APPMETRICA_API_KEY
 * 2. app.json / app.config extra.appMetricaApiKey
 *
 * Leave empty until a real partner key is provided.
 */
export function resolveAppMetricaApiKey (): string {
	const fromEnv =
		typeof process !== 'undefined'
			? process.env.EXPO_PUBLIC_APPMETRICA_API_KEY?.trim()
			: ''
	if (fromEnv) {
		return fromEnv
	}
	const extra = Constants.expoConfig?.extra as
		| { appMetricaApiKey?: string }
		| undefined
	const fromExtra = extra?.appMetricaApiKey?.trim()
	return fromExtra ?? ''
}

export function hasAppMetricaApiKey (): boolean {
	return resolveAppMetricaApiKey().length > 0
}
