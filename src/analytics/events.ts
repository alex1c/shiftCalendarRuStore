/**
 * Privacy-safe analytics event names and property sanitization.
 * Never attach salary amounts, notes, names, dates, or backup contents.
 */

export const ANALYTICS_EVENTS = {
	appOpen: 'app_open',
	onboardingCompleted: 'onboarding_completed',
	profileCreated: 'profile_created',
	profileSwitched: 'profile_switched',
	customCycleCreated: 'custom_cycle_created',
	dayOverrideCreated: 'day_override_created',
	vacationSet: 'vacation_set',
	extraShiftSet: 'extra_shift_set',
	salaryEnabled: 'salary_enabled',
	notificationEnabled: 'notification_enabled',
	backupCreated: 'backup_created',
	backupRestored: 'backup_restored',
	pdfShared: 'pdf_shared',
	statisticsViewed: 'statistics_viewed',
} as const

export type AnalyticsEventName =
	(typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS]

/** Keys that must never leave the device via analytics. */
export const SENSITIVE_ANALYTICS_KEYS = [
	'salary',
	'salary_amount',
	'amount',
	'hourly',
	'hourly_rate',
	'rate',
	'notes',
	'note',
	'name',
	'profile_name',
	'schedule',
	'cycle',
	'date',
	'start_date',
	'end_date',
	'vacation_date',
	'notification',
	'notification_body',
	'backup',
	'backup_contents',
	'content',
	'text',
	'title',
] as const

export type AnalyticsPrimitive = string | number | boolean

export type AnalyticsProperties = Record<string, AnalyticsPrimitive>

/**
 * Bucket profile counts so we never send exact identity-adjacent sizes
 * beyond coarse buckets.
 */
export function bucketProfileCount (count: number): string {
	if (count <= 0) {
		return '0'
	}
	if (count === 1) {
		return '1'
	}
	if (count === 2) {
		return '2'
	}
	return '3_plus'
}

/**
 * Strip sensitive keys and non-primitive values from event properties.
 */
export function sanitizeAnalyticsProperties (
	input: Record<string, unknown> | undefined,
): AnalyticsProperties | undefined {
	if (!input) {
		return undefined
	}
	const blocked = new Set<string>(
		SENSITIVE_ANALYTICS_KEYS.map((key) => key.toLowerCase()),
	)
	const result: AnalyticsProperties = {}
	for (const [rawKey, value] of Object.entries(input)) {
		const key = rawKey.trim()
		if (!key) {
			continue
		}
		if (blocked.has(key.toLowerCase())) {
			continue
		}
		if (
			typeof value === 'string' ||
			typeof value === 'number' ||
			typeof value === 'boolean'
		) {
			// Reject long free-text strings that look like notes.
			if (typeof value === 'string' && value.length > 64) {
				continue
			}
			result[key] = value
		}
	}
	return Object.keys(result).length > 0 ? result : undefined
}
