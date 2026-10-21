/**
 * Banner placement mapping — production units must stay within cabinet IDs.
 */

import {
	BANNER_PLACEMENT_UNITS,
	YANDEX_DEMO_UNITS,
	YANDEX_PRODUCTION_UNITS,
	resolveBannerUnitId,
} from '@/src/ads/adsConfig'

describe('banner placement units', () => {
	it('keeps only cabinet banner IDs R-M-20020358-1..4', () => {
		expect(YANDEX_PRODUCTION_UNITS.banners).toEqual([
			'R-M-20020358-1',
			'R-M-20020358-2',
			'R-M-20020358-3',
			'R-M-20020358-4',
		])
	})

	it('uses the proven-working production block for main sticky placements', () => {
		// Store QA: only R-M-20020358-3 delivered fill on «Ещё».
		const working = YANDEX_PRODUCTION_UNITS.banners[2]
		expect(BANNER_PLACEMENT_UNITS.calendar).toBe(working)
		expect(BANNER_PLACEMENT_UNITS.today).toBe(working)
		expect(BANNER_PLACEMENT_UNITS.statistics).toBe(working)
		expect(BANNER_PLACEMENT_UNITS.more).toBe(working)
		expect(BANNER_PLACEMENT_UNITS.notifications).toBe(working)
	})

	it('resolves demo units in development and production units otherwise', () => {
		expect(resolveBannerUnitId('calendar', true)).toBe(
			YANDEX_DEMO_UNITS.banner,
		)
		expect(resolveBannerUnitId('calendar', false)).toBe(
			BANNER_PLACEMENT_UNITS.calendar,
		)
		expect(resolveBannerUnitId('more', false)).toBe(
			'R-M-20020358-3',
		)
	})
})
