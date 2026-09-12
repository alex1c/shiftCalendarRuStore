/**
 * Interstitial load/show controller — policy first, native second.
 * Failures never throw to product UI.
 */

import { resolveInterstitialUnitId } from './adsConfig'
import {
	evaluateInterstitialEligibility,
	markInterstitialShown,
	type AdsSessionState,
	type InterstitialTrigger,
} from './adsSessionPolicy'
import { loadYandexAds } from './yandexAdsNative'

export type ShowInterstitialResult =
	| { shown: true }
	| { shown: false; reason: string }

/**
 * Attempt to show one interstitial when policy allows.
 * Returns an updated session state (caller must store it).
 */
export async function tryShowInterstitial (
	state: AdsSessionState,
	trigger: InterstitialTrigger,
	options: {
		isDev?: boolean
		now?: number
		/** Injected for unit tests — skip native when provided. */
		showNative?: (unitId: string) => Promise<void>
	} = {},
): Promise<{ result: ShowInterstitialResult; state: AdsSessionState }> {
	const decision = evaluateInterstitialEligibility(
		state,
		trigger,
		options.now ?? Date.now(),
	)
	if (!decision.allowed) {
		return {
			result: { shown: false, reason: decision.reason },
			state,
		}
	}

	const unitId = resolveInterstitialUnitId(options.isDev ?? __DEV__)

	try {
		if (options.showNative) {
			await options.showNative(unitId)
		} else {
			const sdk = loadYandexAds()
			if (!sdk) {
				return {
					result: { shown: false, reason: 'sdk_unavailable' },
					state,
				}
			}
			const loader = await sdk.InterstitialAdLoader.create()
			const ad = await loader.loadAd({ adUnitId: unitId })
			await ad.show()
		}
		return {
			result: { shown: true },
			state: markInterstitialShown(state),
		}
	} catch {
		return {
			result: { shown: false, reason: 'load_or_show_failed' },
			state,
		}
	}
}
