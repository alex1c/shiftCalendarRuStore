/**
 * AppMetrica configuration — never invent an API key.
 * When the key is missing, analytics stays a no-op.
 */

import Constants from 'expo-constants'

/**
 * Mask API key for DEV source-trace logs — never emit the full secret.
 */
function maskApiKeyForDebug (apiKey: string): string {
	if (apiKey.length < 12) {
		return '(too-short)'
	}
	return `${apiKey.slice(0, 8)}...${apiKey.slice(-4)}`
}

/**
 * Optional key sources (first non-empty wins):
 * 1. EXPO_PUBLIC_APPMETRICA_API_KEY
 * 2. app.json / app.config extra.appMetricaApiKey
 *
 * Leave empty until a real partner key is provided.
 */
export function resolveAppMetricaApiKey (): string {
	if (__DEV__) {
		console.log('[AnalyticsDebug] env lookup start')
	}
	const fromEnv =
		typeof process !== 'undefined'
			? process.env.EXPO_PUBLIC_APPMETRICA_API_KEY?.trim()
			: ''
	if (__DEV__) {
		console.log(
			`[AnalyticsDebug] env lookup result=${fromEnv ? maskApiKeyForDebug(fromEnv) : '(empty)'}`,
		)
	}
	if (fromEnv) {
		return fromEnv
	}
	if (__DEV__) {
		console.log('[AnalyticsDebug] Constants.expoConfig lookup start')
	}
	const extra = Constants.expoConfig?.extra as
		| { appMetricaApiKey?: string }
		| undefined
	const fromExtra = extra?.appMetricaApiKey?.trim()
	if (__DEV__) {
		console.log(
			`[AnalyticsDebug] extra lookup result=${fromExtra ? maskApiKeyForDebug(fromExtra) : '(empty)'}`,
		)
	}
	return fromExtra ?? ''
}

export function hasAppMetricaApiKey (): boolean {
	return resolveAppMetricaApiKey().length > 0
}
