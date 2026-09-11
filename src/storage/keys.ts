/**
 * Versioned AsyncStorage keys for the shift calendar.
 */

export const STORAGE_SCHEMA_VERSION = 3

export const STORAGE_KEYS = {
	meta: '@shiftcalendar/meta',
	schedule: '@shiftcalendar/schedule',
	overrides: '@shiftcalendar/overrides',
	salary: '@shiftcalendar/salary',
	profiles: '@shiftcalendar/profiles',
	activeProfile: '@shiftcalendar/activeProfile',
} as const
