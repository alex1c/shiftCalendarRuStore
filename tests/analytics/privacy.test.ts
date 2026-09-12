/**
 * Analytics privacy + missing AppMetrica key behavior.
 */

import {
	__resetAnalyticsForTests,
	activateAnalytics,
	isAnalyticsActivated,
	trackEvent,
} from '@/src/analytics/analytics'
import {
	hasAppMetricaApiKey,
	resolveAppMetricaApiKey,
} from '@/src/analytics/analyticsConfig'
import {
	ANALYTICS_EVENTS,
	SENSITIVE_ANALYTICS_KEYS,
	bucketProfileCount,
	sanitizeAnalyticsProperties,
} from '@/src/analytics/events'

describe('analytics privacy', () => {
	it('strips sensitive fields from event payloads', () => {
		const clean = sanitizeAnalyticsProperties({
			override_type: 'vacation',
			feature_enabled: true,
			salary_amount: 50000,
			hourly_rate: 300,
			notes: 'secret note',
			name: 'Иван',
			profile_name: 'Основной',
			date: '2026-09-01',
			backup: '{...}',
			schedule: '2/2',
			period_type: '30',
		})
		expect(clean).toEqual({
			override_type: 'vacation',
			feature_enabled: true,
			period_type: '30',
		})
		for (const key of SENSITIVE_ANALYTICS_KEYS) {
			expect(clean?.[key]).toBeUndefined()
		}
	})

	it('buckets profile counts', () => {
		expect(bucketProfileCount(0)).toBe('0')
		expect(bucketProfileCount(1)).toBe('1')
		expect(bucketProfileCount(2)).toBe('2')
		expect(bucketProfileCount(5)).toBe('3_plus')
	})

	it('exposes the required non-sensitive event names', () => {
		expect(ANALYTICS_EVENTS.appOpen).toBe('app_open')
		expect(ANALYTICS_EVENTS.pdfShared).toBe('pdf_shared')
		expect(ANALYTICS_EVENTS.statisticsViewed).toBe('statistics_viewed')
		expect(ANALYTICS_EVENTS.backupRestored).toBe('backup_restored')
	})
})

describe('AppMetrica missing key', () => {
	beforeEach(() => {
		__resetAnalyticsForTests()
		delete process.env.EXPO_PUBLIC_APPMETRICA_API_KEY
	})

	it('resolves an empty key when none is configured', () => {
		expect(resolveAppMetricaApiKey()).toBe('')
		expect(hasAppMetricaApiKey()).toBe(false)
	})

	it('activateAnalytics fails gracefully without a key', () => {
		const result = activateAnalytics()
		expect(result.ok).toBe(false)
		expect(result.reason).toBe('missing_api_key')
		expect(isAnalyticsActivated()).toBe(false)
	})

	it('trackEvent does not throw when inactive', () => {
		expect(() => {
			trackEvent(ANALYTICS_EVENTS.appOpen, {
				salary_amount: 1,
				override_type: 'vacation',
			})
		}).not.toThrow()
		expect(isAnalyticsActivated()).toBe(false)
	})
})
