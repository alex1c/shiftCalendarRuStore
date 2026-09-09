/**
 * Versioned AsyncStorage keys for the shift calendar.
 */

export const STORAGE_SCHEMA_VERSION = 1

export const STORAGE_KEYS = {
	meta: '@shiftcalendar/meta',
	schedule: '@shiftcalendar/schedule',
} as const
