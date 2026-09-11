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
		constructor (...parts: unknown[]) {
			this.uri = parts.map(String).join('/')
		}
		create () {
			return undefined
		}
		write () {
			return undefined
		}
		async text () {
			return ''
		}
	}
	return {
		File: MockFile,
		Paths: { cache: 'cache', document: 'document' },
	}
})

jest.mock('expo-sharing', () => ({
	isAvailableAsync: jest.fn(async () => false),
	shareAsync: jest.fn(async () => undefined),
}))

jest.mock('expo-document-picker', () => ({
	getDocumentAsync: jest.fn(async () => ({ canceled: true, assets: null })),
}))
