/**
 * Centralized Yandex Mobile Ads (РСЯ) configuration.
 * Production block IDs live here only — screens never hard-code them.
 */

/** Partner cabinet application id (UUID). Ad units are the runtime identifiers. */
export const YANDEX_ADS_APP_ID = 'e0b1b59c-bed2-4f4f-a8e3-b14603f56a32'

/** Official Yandex demo unit ids — used in __DEV__ to avoid production QA traffic. */
export const YANDEX_DEMO_UNITS = {
	banner: 'demo-banner-yandex',
	interstitial: 'demo-interstitial-yandex',
	rewarded: 'demo-rewarded-yandex',
} as const

/** Production ad unit ids from the partner cabinet (do not invent others). */
export const YANDEX_PRODUCTION_UNITS = {
	banners: [
		'R-M-20020358-1',
		'R-M-20020358-2',
		'R-M-20020358-3',
		'R-M-20020358-4',
	] as const,
	interstitial: 'R-M-20020358-5',
	/** Stored for future reward UX — Phase 12 does not show rewarded ads. */
	rewarded: 'R-M-20020358-6',
} as const

export type BannerPlacement = 'calendar' | 'statistics' | 'more'

/**
 * Map calm-screen placements to production banner blocks.
 * Today has no banner (policy: not above the fold).
 */
export const BANNER_PLACEMENT_UNITS: Record<
	BannerPlacement,
	(typeof YANDEX_PRODUCTION_UNITS.banners)[number]
> = {
	calendar: YANDEX_PRODUCTION_UNITS.banners[0],
	statistics: YANDEX_PRODUCTION_UNITS.banners[1],
	more: YANDEX_PRODUCTION_UNITS.banners[2],
}

/** Whether this JS runtime should use demo units + SDK debug helpers. */
export function isAdsTestMode (isDev: boolean = __DEV__): boolean {
	return isDev
}

/** Resolve the banner unit for a placement (demo in development). */
export function resolveBannerUnitId (
	placement: BannerPlacement,
	isDev: boolean = __DEV__,
): string {
	if (isAdsTestMode(isDev)) {
		return YANDEX_DEMO_UNITS.banner
	}
	return BANNER_PLACEMENT_UNITS[placement]
}

/** Resolve interstitial unit (demo in development). */
export function resolveInterstitialUnitId (
	isDev: boolean = __DEV__,
): string {
	if (isAdsTestMode(isDev)) {
		return YANDEX_DEMO_UNITS.interstitial
	}
	return YANDEX_PRODUCTION_UNITS.interstitial
}

/** Rewarded id is reserved — not used in Phase 12 UI. */
export function resolveRewardedUnitId (
	isDev: boolean = __DEV__,
): string {
	if (isAdsTestMode(isDev)) {
		return YANDEX_DEMO_UNITS.rewarded
	}
	return YANDEX_PRODUCTION_UNITS.rewarded
}
