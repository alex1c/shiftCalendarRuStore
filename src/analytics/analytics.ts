/**
 * AppMetrica wrapper — activates only when a real API key is configured.
 * Failures never throw to callers; missing key is a quiet no-op.
 *
 * Uses AppMetrica.activate() from @appmetrica/react-native-analytics@4.2.0
 * (activateWithConfig is outdated README API and must not be used).
 *
 * Hermes/Metro runtime shape for 4.2.0:
 *   require(...) → { default: class/function AppMetrica }
 *   typeof default === 'function' (not 'object')
 *   default.activate / default.reportEvent are static methods
 */

import {
	hasAppMetricaApiKey,
	resolveAppMetricaApiKey,
} from './analyticsConfig'
import {
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
/**
 * Set only after native activate() throws — avoids hammering a broken SDK.
 * SDK-unavailable / missing-key do NOT lock retries forever.
 */
let activationFailedPermanently = false

/**
 * True when `value` exposes the AppMetrica 4.2 activate/reportEvent surface.
 * Classes are typeof 'function' in JS — must not require typeof === 'object'.
 */
function isAppMetricaModule (value: unknown): value is AppMetricaModule {
	if (value == null) {
		return false
	}
	const kind = typeof value
	if (kind !== 'object' && kind !== 'function') {
		return false
	}
	const record = value as Record<string, unknown>
	return (
		typeof record.activate === 'function' &&
		typeof record.reportEvent === 'function'
	)
}

/**
 * Resolve the AppMetrica default export (or module itself) when it exposes
 * activate() as required by SDK 4.2.0.
 * Accepts object OR callable/class default exports (Hermes runtime).
 */
export function resolveAppMetricaModule (
	mod: unknown,
): AppMetricaModule | null {
	if (isAppMetricaModule(mod)) {
		return mod
	}
	if (mod == null) {
		return null
	}
	const kind = typeof mod
	if (kind !== 'object' && kind !== 'function') {
		return null
	}
	const nested = (mod as { default?: unknown }).default
	if (isAppMetricaModule(nested)) {
		return nested
	}
	return null
}

function loadAppMetrica (): AppMetricaModule | null {
	try {
		// eslint-disable-next-line @typescript-eslint/no-require-imports
		const mod = require('@appmetrica/react-native-analytics')
		return resolveAppMetricaModule(mod)
	} catch {
		return null
	}
}

/**
 * Activate AppMetrica once on success. Safe when the key is missing or the
 * native module is unavailable (Expo Go / incomplete native build).
 */
export function activateAnalytics (): { ok: boolean; reason?: string } {
	if (activated) {
		return { ok: true }
	}
	if (activationFailedPermanently) {
		return { ok: false, reason: 'activation_failed_earlier' }
	}
	const apiKey = resolveAppMetricaApiKey()
	if (!apiKey) {
		return { ok: false, reason: 'missing_api_key' }
	}
	const sdk = loadAppMetrica()
	if (!sdk) {
		// Do not lock retries — Metro/native may become available later.
		return { ok: false, reason: 'sdk_unavailable' }
	}
	try {
		sdk.activate({
			apiKey,
			sessionTimeout: 120,
			firstActivationAsUpdate: false,
			logs: __DEV__,
		})
		activated = true
		return { ok: true }
	} catch {
		activationFailedPermanently = true
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
	activationFailedPermanently = false
}

export function isAnalyticsActivated (): boolean {
	return activated
}
