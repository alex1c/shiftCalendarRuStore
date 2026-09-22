/**
 * Release metadata sanity — display name, package, icon paths,
 * and hard consistency between Expo config and native Android versions.
 */

import fs from 'fs'
import path from 'path'

import appJson from '../../app.json'

/**
 * Parse versionCode / versionName from android/app/build.gradle defaultConfig.
 * Fails loudly if either field is missing so drift cannot slip through silently.
 */
function readNativeAndroidVersion(gradleSource: string): {
	versionCode: number
	versionName: string
} {
	const versionCodeMatch = gradleSource.match(/versionCode\s+(\d+)/)
	const versionNameMatch = gradleSource.match(
		/versionName\s+"([^"]+)"/,
	)

	if (!versionCodeMatch) {
		throw new Error(
			'android/app/build.gradle is missing versionCode',
		)
	}
	if (!versionNameMatch) {
		throw new Error(
			'android/app/build.gradle is missing versionName',
		)
	}

	return {
		versionCode: Number(versionCodeMatch[1]),
		versionName: versionNameMatch[1],
	}
}

describe('release metadata', () => {
	const expo = appJson.expo

	it('keeps the RuStore display name and package', () => {
		expect(expo.name).toBe('Мой график смен')
		expect(expo.android.package).toBe(
			'com.calculatorplatform.shiftcalendar',
		)
		expect(expo.version).toBe('1.0.1')
		expect(expo.android.versionCode).toBe(2)
	})

	it('keeps Expo app.json and native Android versions in sync', () => {
		// Regression guard: Expo config alone is not enough — the checked-in
		// android/app/build.gradle is what release APK/AAB actually ships.
		const gradlePath = path.join(
			__dirname,
			'..',
			'..',
			'android',
			'app',
			'build.gradle',
		)
		const gradleSource = fs.readFileSync(gradlePath, 'utf8')
		const native = readNativeAndroidVersion(gradleSource)

		expect(native.versionName).toBe(expo.version)
		expect(native.versionCode).toBe(expo.android.versionCode)
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
