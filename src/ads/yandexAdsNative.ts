/**
 * Lazy Yandex Mobile Ads native bridge access.
 * Keeps imports resilient when the native module is missing (tests / Expo Go).
 */

import type { ComponentType } from 'react'

export type YandexAdsBridge = {
	MobileAds: {
		initialize: () => Promise<void>
		enableLogging: (enable: boolean) => void
		enableDebugErrorIndicator: (enable: boolean) => void
		pluginVersion: string
	}
	BannerView: ComponentType<{
		size: unknown
		adUnitId: string
		onAdLoaded?: () => void
		onAdFailedToLoad?: (event: unknown) => void
		onAdClicked?: () => void
		onAdClose?: () => void
		style?: object
	}>
	BannerAdSize: {
		stickySize: (width: number) => Promise<unknown>
	}
	InterstitialAdLoader: {
		create: () => Promise<{
			loadAd: (params: { adUnitId: string }) => Promise<{
				show: () => Promise<void>
			}>
		}>
	}
}

let cached: YandexAdsBridge | null | undefined

export function loadYandexAds (): YandexAdsBridge | null {
	if (cached !== undefined) {
		return cached
	}
	try {
		// eslint-disable-next-line @typescript-eslint/no-require-imports
		const mod = require('yandex-mobile-ads') as YandexAdsBridge
		cached = mod
		return mod
	} catch {
		cached = null
		return null
	}
}

/** Test helper — clear the lazy cache. */
export function __resetYandexAdsCacheForTests (): void {
	cached = undefined
}
