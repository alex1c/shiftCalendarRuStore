/**
 * Public ads module surface.
 */

export {
	BANNER_PLACEMENT_UNITS,
	YANDEX_ADS_APP_ID,
	YANDEX_DEMO_UNITS,
	YANDEX_PRODUCTION_UNITS,
	isAdsTestMode,
	resolveBannerUnitId,
	resolveInterstitialUnitId,
	resolveRewardedUnitId,
	type BannerPlacement,
} from './adsConfig'
export { AdsProvider, useAds } from './AdsProvider'
export { AdsLifecycleBridge } from './AdsLifecycleBridge'
export { BannerAdSlot } from './BannerAdSlot'
export {
	INTERSTITIAL_MIN_INTERACTIONS,
	INTERSTITIAL_MIN_SESSION_MS,
	createAdsSessionState,
	evaluateInterstitialEligibility,
	enterProtectedFlow,
	exitProtectedFlow,
	markInterstitialShown,
	recordAdsInteraction,
	setOnboardingActive,
	type AdsSessionState,
	type InterstitialDecision,
	type InterstitialTrigger,
} from './adsSessionPolicy'
export { tryShowInterstitial } from './interstitialController'
export {
	useAdsProtectedFlow,
	useAdsProtectionFlag,
} from './useAdsProtectedFlow'
