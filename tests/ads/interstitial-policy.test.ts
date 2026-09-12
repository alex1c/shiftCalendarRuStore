/**
 * Ads session / interstitial policy unit tests.
 */

import {
	isAdsTestMode,
	resolveBannerUnitId,
	resolveInterstitialUnitId,
	YANDEX_DEMO_UNITS,
	YANDEX_PRODUCTION_UNITS,
} from '@/src/ads/adsConfig'
import {
	createAdsSessionState,
	enterProtectedFlow,
	evaluateInterstitialEligibility,
	exitProtectedFlow,
	INTERSTITIAL_MIN_INTERACTIONS,
	INTERSTITIAL_MIN_SESSION_MS,
	markInterstitialShown,
	recordAdsInteraction,
	setOnboardingActive,
} from '@/src/ads/adsSessionPolicy'
import { tryShowInterstitial } from '@/src/ads/interstitialController'

const NOW = 1_700_000_000_000

function eligibleState (now: number) {
	let state = createAdsSessionState({
		now: now - INTERSTITIAL_MIN_SESSION_MS - 1_000,
		isFirstLaunchSession: false,
	})
	state = recordAdsInteraction(state, INTERSTITIAL_MIN_INTERACTIONS)
	return state
}

describe('ads interstitial policy', () => {
	it('allows at most one interstitial per session', async () => {
		let state = eligibleState(NOW)
		const first = await tryShowInterstitial(state, 'statistics_viewed', {
			now: NOW,
			isDev: true,
			showNative: async () => undefined,
		})
		expect(first.result.shown).toBe(true)
		state = first.state
		expect(state.interstitialShownThisSession).toBe(true)

		const second = await tryShowInterstitial(state, 'pdf_shared', {
			now: NOW,
			isDev: true,
			showNative: async () => undefined,
		})
		expect(second.result.shown).toBe(false)
		expect(second.result).toMatchObject({
			reason: 'already_shown_this_session',
		})
	})

	it('blocks interstitial on first launch session', () => {
		const state = {
			...eligibleState(NOW),
			isFirstLaunchSession: true,
		}
		const decision = evaluateInterstitialEligibility(
			state,
			'statistics_viewed',
			NOW,
		)
		expect(decision).toEqual({
			allowed: false,
			reason: 'first_launch_session',
		})
	})

	it('blocks interstitial in protected flows', () => {
		let state = eligibleState(NOW)
		state = enterProtectedFlow(state)
		expect(
			evaluateInterstitialEligibility(state, 'pdf_shared', NOW),
		).toEqual({ allowed: false, reason: 'protected_flow' })
		state = exitProtectedFlow(state)
		expect(
			evaluateInterstitialEligibility(state, 'pdf_shared', NOW).allowed,
		).toBe(true)
	})

	it('blocks interstitial during onboarding', () => {
		let state = eligibleState(NOW)
		state = setOnboardingActive(state, true)
		expect(
			evaluateInterstitialEligibility(state, 'neutral_navigation', NOW),
		).toEqual({ allowed: false, reason: 'onboarding_active' })
	})

	it('requires delayed start and interaction threshold', () => {
		const fresh = createAdsSessionState({
			now: NOW,
			isFirstLaunchSession: false,
		})
		expect(
			evaluateInterstitialEligibility(fresh, 'statistics_viewed', NOW),
		).toEqual({ allowed: false, reason: 'session_too_short' })

		const aged = createAdsSessionState({
			now: NOW - INTERSTITIAL_MIN_SESSION_MS - 1,
			isFirstLaunchSession: false,
		})
		expect(
			evaluateInterstitialEligibility(aged, 'statistics_viewed', NOW),
		).toEqual({ allowed: false, reason: 'below_interaction_threshold' })
	})

	it('marks shown via markInterstitialShown helper', () => {
		const state = markInterstitialShown(eligibleState(NOW))
		expect(state.interstitialShownThisSession).toBe(true)
	})
})

describe('ads config units', () => {
	it('uses demo units in development / test mode', () => {
		expect(isAdsTestMode(true)).toBe(true)
		expect(resolveBannerUnitId('calendar', true)).toBe(
			YANDEX_DEMO_UNITS.banner,
		)
		expect(resolveInterstitialUnitId(true)).toBe(
			YANDEX_DEMO_UNITS.interstitial,
		)
	})

	it('uses production units outside test mode', () => {
		expect(resolveBannerUnitId('calendar', false)).toBe(
			YANDEX_PRODUCTION_UNITS.banners[0],
		)
		expect(resolveBannerUnitId('statistics', false)).toBe(
			YANDEX_PRODUCTION_UNITS.banners[1],
		)
		expect(resolveBannerUnitId('more', false)).toBe(
			YANDEX_PRODUCTION_UNITS.banners[2],
		)
		expect(resolveInterstitialUnitId(false)).toBe(
			YANDEX_PRODUCTION_UNITS.interstitial,
		)
	})
})

describe('ads failure isolation', () => {
	it('does not throw when native show fails', async () => {
		const state = eligibleState(NOW)
		const result = await tryShowInterstitial(state, 'pdf_shared', {
			now: NOW,
			isDev: true,
			showNative: async () => {
				throw new Error('network')
			},
		})
		expect(result.result.shown).toBe(false)
		expect(result.state.interstitialShownThisSession).toBe(false)
	})
})
