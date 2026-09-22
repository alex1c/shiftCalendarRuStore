/**
 * AppMetrica wrapper — activates only when a real API key is configured.
 * Failures never throw to callers; missing key is a quiet no-op.
 *
 * Uses AppMetrica.activate() from @appmetrica/react-native-analytics@4.2.0
 * (activateWithConfig is outdated README API and must not be used).
 */

import {
	hasAppMetricaApiKey,
	resolveAppMetricaApiKey,
} from './analyticsConfig'
import {
	ANALYTICS_EVENTS,
	sanitizeAnalyticsProperties,
	type AnalyticsEventName,
	type AnalyticsProperties,
} from './events'

type AppMetricaActivationConfig = {
	apiKey: string
	sessionTimeout?: number
	firstActivationAsUpdate?: boolean
	logs?: boolean
}

type AppMetricaModule = {
	activate: (config: AppMetricaActivationConfig) => void
	reportEvent: (
		name: string,
		params?: Record<string, string | number | boolean>,
	) => void
}

let activated = false
let activationAttempted = false
/** DEV-only: log app_open track request once to keep logcat readable. */
let appOpenDebugLogged = false

/**
 * Mask API key for DEV logs: prefix...suffix, never the full secret.
 * Example: e0b1b59c-bed2-... → e0b1b59c...6a32
 */
function maskApiKeyForDebug (apiKey: string): string {
	if (apiKey.length < 12) {
		return '(too-short)'
	}
	return `${apiKey.slice(0, 8)}...${apiKey.slice(-4)}`
}

/** Safe error text for DEV logs — message only, no payloads. */
function safeErrorForDebug (error: unknown): string {
	if (error instanceof Error) {
		return error.message || error.name
	}
	return typeof error === 'string' ? error : 'unknown_error'
}

/**
 * Resolve the AppMetrica default export (or module itself) when it exposes
 * activate() as required by SDK 4.2.0.
 */
export function resolveAppMetricaModule (
	mod: unknown,
): AppMetricaModule | null {
	if (!mod || typeof mod !== 'object') {
		return null
	}
	const candidate = mod as Record<string, unknown>
	if (typeof candidate.activate === 'function') {
		return candidate as unknown as AppMetricaModule
	}
	const nested = candidate.default
	if (
		nested &&
		typeof nested === 'object' &&
		typeof (nested as Record<string, unknown>).activate === 'function'
	) {
		return nested as AppMetricaModule
	}
	return null
}

/**
 * DEV-only: dump require() success and export shape so logcat shows whether
 * activate lives on module vs module.default (CJS/Metro interop).
 */
function logAppMetricaModuleShape (
	requireSucceeded: boolean,
	mod: unknown,
): void {
	if (!__DEV__) {
		return
	}
	console.log(
		`[AnalyticsDebug] require succeeded ${requireSucceeded ? 'YES' : 'NO'}`,
	)
	console.log(`[AnalyticsDebug] module typeof=${typeof mod}`)
	if (!mod || typeof mod !== 'object') {
		console.log('[AnalyticsDebug] module.activate=<n/a>')
		console.log('[AnalyticsDebug] module.default=<n/a>')
		console.log('[AnalyticsDebug] default.activate=<n/a>')
		return
	}
	const record = mod as Record<string, unknown>
	const nested = record.default
	console.log('[AnalyticsDebug] module loaded')
	console.log(`[AnalyticsDebug] module.activate=${typeof record.activate}`)
	console.log(`[AnalyticsDebug] module.default=${typeof nested}`)
	if (nested && typeof nested === 'object') {
		console.log(
			`[AnalyticsDebug] default.activate=${typeof (nested as Record<string, unknown>).activate}`,
		)
	} else {
		console.log('[AnalyticsDebug] default.activate=<n/a>')
	}
}

function loadAppMetrica (): AppMetricaModule | null {
	try {
		// eslint-disable-next-line @typescript-eslint/no-require-imports
		const mod = require('@appmetrica/react-native-analytics')
		logAppMetricaModuleShape(true, mod)
		return resolveAppMetricaModule(mod)
	} catch (error) {
		logAppMetricaModuleShape(false, null)
		if (__DEV__) {
			console.log(
				`[AnalyticsDebug] AppMetrica require failed: ${safeErrorForDebug(error)}`,
			)
		}
		return null
	}
}

/**
 * Activate AppMetrica once. Safe when the key is missing or the native
 * module is unavailable (Expo Go / incomplete native build).
 */
export function activateAnalytics (): { ok: boolean; reason?: string } {
	if (__DEV__) {
		console.log('[AnalyticsDebug] activateAnalytics entered')
	}
	if (activationAttempted) {
		return activated
			? { ok: true }
			: { ok: false, reason: 'activation_failed_earlier' }
	}
	activationAttempted = true
	const apiKey = resolveAppMetricaApiKey()
	if (__DEV__) {
		console.log(
			`[AnalyticsDebug] apiKey=${apiKey ? maskApiKeyForDebug(apiKey) : '(empty)'}`,
		)
	}
	if (!apiKey) {
		return { ok: false, reason: 'missing_api_key' }
	}
	const sdk = loadAppMetrica()
	if (!sdk) {
		if (__DEV__) {
			console.log('[AnalyticsDebug] sdk unresolved after require/resolve')
		}
		return { ok: false, reason: 'sdk_unavailable' }
	}
	try {
		if (__DEV__) {
			console.log('[AnalyticsDebug] calling AppMetrica.activate')
		}
		sdk.activate({
			apiKey,
			sessionTimeout: 120,
			firstActivationAsUpdate: false,
			logs: __DEV__,
		})
		if (__DEV__) {
			console.log('[AnalyticsDebug] AppMetrica.activate returned')
		}
		activated = true
		return { ok: true }
	} catch (error) {
		if (__DEV__) {
			console.log(
				`[AnalyticsDebug] AppMetrica activation failed: ${safeErrorForDebug(error)}`,
			)
		}
		activated = false
		return { ok: false, reason: 'activation_threw' }
	}
}

/** Report a privacy-safe custom event. Never throws. */
export function trackEvent (
	name: AnalyticsEventName | string,
	properties?: Record<string, unknown>,
): void {
	try {
		// First app_open only — confirms provider reached track without PII.
		if (
			__DEV__ &&
			name === ANALYTICS_EVENTS.appOpen &&
			!appOpenDebugLogged
		) {
			appOpenDebugLogged = true
			console.log('[AnalyticsDebug] appOpen requested')
			console.log(
				`[AnalyticsDebug] analytics active=${activated}`,
			)
		}
		if (!activated && hasAppMetricaApiKey()) {
			activateAnalytics()
		}
		if (!activated) {
			return
		}
		const sdk = loadAppMetrica()
		if (!sdk) {
			return
		}
		const clean = sanitizeAnalyticsProperties(properties)
		if (clean) {
			sdk.reportEvent(name, clean as AnalyticsProperties)
		} else {
			sdk.reportEvent(name)
		}
	} catch {
		// Analytics must never crash product flows.
	}
}

/** Test helper — reset module state between Jest cases. */
export function __resetAnalyticsForTests (): void {
	activated = false
	activationAttempted = false
	appOpenDebugLogged = false
}

export function isAnalyticsActivated (): boolean {
	return activated
}
