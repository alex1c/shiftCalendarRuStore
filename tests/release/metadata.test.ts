/**
 * Release metadata sanity — display name, package, icon paths.
 */

import appJson from '../../app.json'

describe('release metadata', () => {
	const expo = appJson.expo

	it('keeps the RuStore display name and package', () => {
		expect(expo.name).toBe('Мой график смен')
		expect(expo.android.package).toBe(
			'com.calculatorplatform.shiftcalendar',
		)
		expect(expo.version).toBe('1.0.0')
		expect(expo.android.versionCode).toBe(1)
	})

	it('points Expo and adaptive icons at the master release art', () => {
		expect(expo.icon).toBe('./assets/icon_gpt.png')
		expect(expo.android.icon).toBe('./assets/icon_gpt.png')
		expect(expo.android.adaptiveIcon.foregroundImage).toBe(
			'./assets/icon-adaptive-foreground.png',
		)
		expect(expo.android.adaptiveIcon.backgroundColor).toBe('#1D98FE')
	})

	it('keeps ForestMusic developer metadata without publishing secrets', () => {
		expect(expo.extra.developerName).toBe('ForestMusic')
		expect(expo.extra.developerSite).toBe('https://forest-music.ru')
		expect(expo.extra.developerContact).toBe('rustore-alex1c@yandex.ru')
		expect(expo.extra.appMetricaApplicationId).toBe('6355141')
		expect(expo.extra.privacyPolicyUrl).toContain('privacy.html')
	})
})
