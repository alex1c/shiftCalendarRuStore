/**
 * Jest setup — AsyncStorage mock for the Node test environment.
 */

import mockAsyncStorage from '@react-native-async-storage/async-storage/jest/async-storage-mock'

jest.mock('@react-native-async-storage/async-storage', () => mockAsyncStorage)

jest.mock('expo-notifications', () => ({
	setNotificationHandler: jest.fn(),
	getPermissionsAsync: jest.fn(async () => ({ status: 'undetermined' })),
	requestPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
	setNotificationChannelAsync: jest.fn(async () => null),
	scheduleNotificationAsync: jest.fn(async () => 'id'),
	cancelScheduledNotificationAsync: jest.fn(async () => undefined),
	cancelAllScheduledNotificationsAsync: jest.fn(async () => undefined),
	getAllScheduledNotificationsAsync: jest.fn(async () => []),
	AndroidImportance: { DEFAULT: 3, HIGH: 4 },
	AndroidNotificationVisibility: { PRIVATE: 0, PUBLIC: 1, SECRET: -1 },
	SchedulableTriggerInputTypes: { DATE: 'date' },
}))

jest.mock('expo-file-system', () => {
	class MockFile {
		uri: string
		exists = false
		constructor (...parts: unknown[]) {
			this.uri = parts.map(String).join('/')
		}
		create () {
			this.exists = true
			return undefined
		}
		write () {
			return undefined
		}
		delete () {
			this.exists = false
		}
		async text () {
			return ''
		}
		async move (_destination: { uri: string }) {
			return undefined
		}
	}
	return {
		File: MockFile,
		Paths: { cache: 'cache', document: 'document' },
	}
})

jest.mock('expo-file-system/legacy', () => ({
	EncodingType: { UTF8: 'utf8', Base64: 'base64' },
	readAsStringAsync: jest.fn(async () => ''),
	writeAsStringAsync: jest.fn(async () => undefined),
}))

jest.mock('expo-sharing', () => ({
	isAvailableAsync: jest.fn(async () => false),
	shareAsync: jest.fn(async () => undefined),
}))

jest.mock('expo-document-picker', () => ({
	getDocumentAsync: jest.fn(async () => ({ canceled: true, assets: null })),
}))

jest.mock('expo-print', () => ({
	printToFileAsync: jest.fn(async () => ({
		uri: 'file:///cache/Print.pdf',
		numberOfPages: 1,
	})),
	Orientation: { landscape: 'landscape', portrait: 'portrait' },
}))

jest.mock('yandex-mobile-ads', () => ({
	MobileAds: {
		pluginVersion: '8.4.0',
		initialize: jest.fn(async () => undefined),
		enableLogging: jest.fn(),
		enableDebugErrorIndicator: jest.fn(),
	},
	BannerView: () => null,
	BannerAdSize: {
		stickySize: jest.fn(async () => ({ width: 320, height: 50 })),
	},
	InterstitialAdLoader: {
		create: jest.fn(async () => ({
			loadAd: jest.fn(async () => ({
				show: jest.fn(async () => undefined),
			})),
		})),
	},
}))

jest.mock('@appmetrica/react-native-analytics', () => ({
	activateWithConfig: jest.fn(),
	reportEvent: jest.fn(),
}))

jest.mock('expo-constants', () => ({
	expoConfig: {
		extra: {
			appMetricaApiKey: '',
		},
	},
}))

