/**
 * AppMetrica activation against the real 4.2.0 API surface (activate).
 * Covers Hermes/Metro shape: default export is a class/function with statics.
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

const TEST_API_KEY = 'e0b1b59c-bed2-4f4f-a8e3-b14603f56a32'

/**
 * Mimic @appmetrica/react-native-analytics@4.2.0 Hermes runtime:
 * module.default is a callable class with static activate/reportEvent.
 */
function createHermesAppMetricaExport () {
	const activate = jest.fn()
	const reportEvent = jest.fn()
	class AppMetricaClass {
		static activate = activate
		static reportEvent = reportEvent
	}
	return {
		module: { default: AppMetricaClass },
		activate,
		reportEvent,
		AppMetricaClass,
	}
}

describe('AppMetrica activate API (4.2.0)', () => {
	beforeEach(() => {
		__resetAnalyticsForTests()
		mockedActivate.mockReset()
		mockedReportEvent.mockReset()
		process.env.EXPO_PUBLIC_APPMETRICA_API_KEY = TEST_API_KEY
	})

	afterEach(() => {
		delete process.env.EXPO_PUBLIC_APPMETRICA_API_KEY
	})

	it('resolves object and function/class default exports with activate()', () => {
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

		const { module, AppMetricaClass, activate, reportEvent } =
			createHermesAppMetricaExport()
		expect(typeof module.default).toBe('function')
		expect(typeof module.default.activate).toBe('function')
		expect(typeof (module.default as { activate?: unknown }).activate).toBe(
			'function',
		)

		const resolved = resolveAppMetricaModule(module)
		expect(resolved).toBe(AppMetricaClass)
		expect(resolved?.activate).toBe(AppMetricaClass.activate)

		// Drive the resolved class statics the same way activateAnalytics does.
		resolved?.activate({
			apiKey: TEST_API_KEY,
			sessionTimeout: 120,
			firstActivationAsUpdate: false,
			logs: true,
		})
		expect(activate).toHaveBeenCalledTimes(1)
		expect(activate).toHaveBeenCalledWith({
			apiKey: TEST_API_KEY,
			sessionTimeout: 120,
			firstActivationAsUpdate: false,
			logs: true,
		})
		resolved?.reportEvent(ANALYTICS_EVENTS.appOpen, { period_type: '7' })
		expect(reportEvent).toHaveBeenCalledWith(ANALYTICS_EVENTS.appOpen, {
			period_type: '7',
		})

		// Outdated README API must never resolve as a valid SDK surface.
		expect(
			resolveAppMetricaModule({
				activateWithConfig: () => undefined,
				reportEvent: () => undefined,
			}),
		).toBeNull()
		expect(
			resolveAppMetricaModule({
				default: function EmptyClass () {
					return undefined
				},
			}),
		).toBeNull()
	})

	it('activateAnalytics calls activate with the configured apiKey', () => {
		const result = activateAnalytics()
		expect(result).toEqual({ ok: true })
		expect(isAnalyticsActivated()).toBe(true)
		expect(mockedActivate).toHaveBeenCalledTimes(1)
		expect(mockedActivate).toHaveBeenCalledWith({
			apiKey: TEST_API_KEY,
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

	it('does not re-activate when already activated', () => {
		expect(activateAnalytics()).toEqual({ ok: true })
		expect(activateAnalytics()).toEqual({ ok: true })
		expect(mockedActivate).toHaveBeenCalledTimes(1)
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

	it('does not crash when the SDK is missing or throws on activate', () => {
		expect(resolveAppMetricaModule(null)).toBeNull()
		expect(resolveAppMetricaModule(undefined)).toBeNull()
		expect(resolveAppMetricaModule({})).toBeNull()

		mockedActivate.mockImplementation(() => {
			throw new Error('native boom')
		})
		expect(() => activateAnalytics()).not.toThrow()
		expect(isAnalyticsActivated()).toBe(false)
		expect(activateAnalytics()).toEqual({
			ok: false,
			reason: 'activation_failed_earlier',
		})
		expect(() => {
			trackEvent(ANALYTICS_EVENTS.appOpen)
		}).not.toThrow()
		expect(mockedActivate).toHaveBeenCalledTimes(1)
	})
})
