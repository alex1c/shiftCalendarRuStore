/**
 * Unique ids for persisted records. Not cryptographically strong —
 * local uniqueness on one device is enough for Phase 1.
 */

export function createId (prefix: string): string {
	const time = Date.now().toString(36)
	const random = Math.random().toString(36).slice(2, 10)
	return `${prefix}_${time}_${random}`
}
