/**
 * AppMetrica activation against the real 4.2.0 API surface (activate).
 */

import AppMetrica from '@appmetrica/react-native-analytics'

import {
	__resetAnalyticsForTests,
	activateAnalytics,
	isAnalyticsActivated,
	resolveAppMetricaModule,
	trackEvent,
} from '@/src/analytics/analytics'
import { ANALYTICS_EVENTS } from '@/src/analytics/events'

const mockedActivate = AppMetrica.activate as jest.Mock
const mockedReportEvent = AppMetrica.reportEvent as jest.Mock

describe('AppMetrica activate API (4.2.0)', () => {
	beforeEach(() => {
		__resetAnalyticsForTests()
		mockedActivate.mockReset()
		mockedReportEvent.mockReset()
		process.env.EXPO_PUBLIC_APPMETRICA_API_KEY =
			'e0b1b59c-bed2-4f4f-a8e3-b14603f56a32'
	})

	afterEach(() => {
		delete process.env.EXPO_PUBLIC_APPMETRICA_API_KEY
	})

	it('resolves a module that exposes activate()', () => {
		expect(
			resolveAppMetricaModule({
				activate: () => undefined,
				reportEvent: () => undefined,
			}),
		).not.toBeNull()
		expect(
			resolveAppMetricaModule({
				default: {
					activate: () => undefined,
					reportEvent: () => undefined,
				},
			}),
		).not.toBeNull()
		expect(
			resolveAppMetricaModule({
				activateWithConfig: () => undefined,
				reportEvent: () => undefined,
			}),
		).toBeNull()
	})

	it('activateAnalytics calls activate with the configured apiKey', () => {
		const result = activateAnalytics()
		expect(result).toEqual({ ok: true })
		expect(isAnalyticsActivated()).toBe(true)
		expect(mockedActivate).toHaveBeenCalledTimes(1)
		expect(mockedActivate).toHaveBeenCalledWith({
			apiKey: 'e0b1b59c-bed2-4f4f-a8e3-b14603f56a32',
			sessionTimeout: 120,
			firstActivationAsUpdate: false,
			logs: expect.any(Boolean),
		})
		expect(
			Object.prototype.hasOwnProperty.call(
				mockedActivate.mock.calls[0][0],
				'activateWithConfig',
			),
		).toBe(false)
	})

	it('trackEvent reaches the SDK after activation', () => {
		activateAnalytics()
		trackEvent(ANALYTICS_EVENTS.appOpen, {
			period_type: '30',
			salary_amount: 999,
		})
		expect(mockedReportEvent).toHaveBeenCalledWith(
			ANALYTICS_EVENTS.appOpen,
			{ period_type: '30' },
		)
	})

	it('does not crash when the SDK throws on activate', () => {
		mockedActivate.mockImplementation(() => {
			throw new Error('native boom')
		})
		expect(() => activateAnalytics()).not.toThrow()
		expect(isAnalyticsActivated()).toBe(false)
		expect(() => {
			trackEvent(ANALYTICS_EVENTS.appOpen)
		}).not.toThrow()
	})
})
