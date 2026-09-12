/**
 * AppMetrica wrapper — activates only when a real API key is configured.
 * Failures never throw to callers; missing key is a quiet no-op.
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

type AppMetricaModule = {
	activateWithConfig: (config: {
		apiKey: string
		sessionTimeout?: number
		firstActivationAsUpdate?: boolean
		logs?: boolean
	}) => void
	reportEvent: (
		name: string,
		params?: Record<string, string | number | boolean>,
	) => void
}

let activated = false
let activationAttempted = false

function loadAppMetrica (): AppMetricaModule | null {
	try {
		// eslint-disable-next-line @typescript-eslint/no-require-imports
		const mod = require('@appmetrica/react-native-analytics') as
			| AppMetricaModule
			| { default: AppMetricaModule }
		if (mod && 'activateWithConfig' in mod) {
			return mod
		}
		if (
			mod &&
			'default' in mod &&
			mod.default &&
			'activateWithConfig' in mod.default
		) {
			return mod.default
		}
		return null
	} catch {
		return null
	}
}

/**
 * Activate AppMetrica once. Safe when the key is missing or the native
 * module is unavailable (Expo Go / incomplete native build).
 */
export function activateAnalytics (): { ok: boolean; reason?: string } {
	if (activationAttempted) {
		return activated
			? { ok: true }
			: { ok: false, reason: 'activation_failed_earlier' }
	}
	activationAttempted = true
	const apiKey = resolveAppMetricaApiKey()
	if (!apiKey) {
		return { ok: false, reason: 'missing_api_key' }
	}
	const sdk = loadAppMetrica()
	if (!sdk) {
		return { ok: false, reason: 'sdk_unavailable' }
	}
	try {
		sdk.activateWithConfig({
			apiKey,
			sessionTimeout: 120,
			firstActivationAsUpdate: false,
			logs: __DEV__,
		})
		activated = true
		return { ok: true }
	} catch {
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
	activationAttempted = false
}

export function isAnalyticsActivated (): boolean {
	return activated
}
