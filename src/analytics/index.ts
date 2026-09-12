/**
 * Public analytics module surface.
 */

export { AnalyticsProvider } from './AnalyticsProvider'
export {
	activateAnalytics,
	isAnalyticsActivated,
	trackEvent,
	__resetAnalyticsForTests,
} from './analytics'
export {
	hasAppMetricaApiKey,
	resolveAppMetricaApiKey,
} from './analyticsConfig'
export {
	ANALYTICS_EVENTS,
	SENSITIVE_ANALYTICS_KEYS,
	bucketProfileCount,
	sanitizeAnalyticsProperties,
	type AnalyticsEventName,
	type AnalyticsProperties,
} from './events'
