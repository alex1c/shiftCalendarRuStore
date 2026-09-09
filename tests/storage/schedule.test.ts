/**
 * Storage round-trip tests for the active work schedule.
 */

import {
	DEFAULT_SHIFT_TYPES,
	createWorkScheduleFromPreset,
	requireSchedulePreset,
} from '@/src/domain'
import {
	clearAllStorageForTests,
	clearWorkSchedule,
	getWorkSchedule,
	saveWorkSchedule,
} from '@/src/storage'

describe('work schedule storage', () => {
	beforeEach(async () => {
		await clearAllStorageForTests()
	})

	it('returns null when no schedule has been created', async () => {
		await expect(getWorkSchedule()).resolves.toBeNull()
	})

	it('persists and reloads a schedule created from a preset', async () => {
		const schedule = createWorkScheduleFromPreset({
			preset: requireSchedulePreset('2-2'),
			startDate: '2026-09-09',
			shiftTypes: DEFAULT_SHIFT_TYPES,
			now: new Date('2026-09-09T12:00:00.000Z'),
		})
		await saveWorkSchedule(schedule)
		await expect(getWorkSchedule()).resolves.toEqual(schedule)
	})

	it('clears the schedule so onboarding can run again', async () => {
		const schedule = createWorkScheduleFromPreset({
			preset: requireSchedulePreset('1-1'),
			startDate: '2026-09-01',
		})
		await saveWorkSchedule(schedule)
		await clearWorkSchedule()
		await expect(getWorkSchedule()).resolves.toBeNull()
	})
})
