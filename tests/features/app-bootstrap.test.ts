import React from 'react'
import { act, create } from 'react-test-renderer'

import {
	AppBootstrapProvider,
	useAppBootstrap,
} from '@/src/features/bootstrap/AppBootstrap'
import {
	DEFAULT_SHIFT_TYPES,
	createWorkScheduleFromPreset,
	requireSchedulePreset,
} from '@/src/domain'
import {
	getActiveProfileId,
	getNotificationSettings,
	getProfiles,
	getSalarySettings,
	saveActiveProfileId,
	saveProfiles,
} from '@/src/storage'

jest.mock('@/src/storage', () => ({
	clearSalarySettings: jest.fn(),
	clearWorkSchedule: jest.fn(),
	getActiveProfileId: jest.fn(),
	getNotificationSettings: jest.fn(),
	getProfiles: jest.fn(),
	getSalarySettings: jest.fn(),
	saveActiveProfileId: jest.fn(),
	saveDayOverrides: jest.fn(),
	saveNotificationSettings: jest.fn(),
	saveProfiles: jest.fn(),
	saveSalarySettings: jest.fn(),
}))

jest.mock('@/src/notifications', () => ({
	configureNotificationHandling: jest.fn(),
	rescheduleShiftNotifications: jest.fn(),
}))

jest.mock('@/src/analytics', () => ({
	ANALYTICS_EVENTS: {
		backupRestored: 'backup_restored',
		customCycleCreated: 'custom_cycle_created',
		dayOverrideCreated: 'day_override_created',
		extraShiftSet: 'extra_shift_set',
		onboardingCompleted: 'onboarding_completed',
		profileCreated: 'profile_created',
		profileSwitched: 'profile_switched',
		salaryEnabled: 'salary_enabled',
		vacationSet: 'vacation_set',
	},
	bucketProfileCount: (count: number) => count,
	trackEvent: jest.fn(),
}))

const flushAsyncEffects = async () => {
	await Promise.resolve()
	await Promise.resolve()
}

describe('AppBootstrap first-profile state propagation', () => {
	it('updates the live root state immediately after the first profile is saved', async () => {
		jest.mocked(getProfiles).mockResolvedValue([])
		jest.mocked(getActiveProfileId).mockResolvedValue(null)
		jest.mocked(getSalarySettings).mockResolvedValue(null)
		jest.mocked(getNotificationSettings).mockResolvedValue(null)
		jest.mocked(saveProfiles).mockResolvedValue(undefined)
		jest.mocked(saveActiveProfileId).mockResolvedValue(undefined)

		let bootstrap: ReturnType<typeof useAppBootstrap> | null = null
		function Probe () {
			bootstrap = useAppBootstrap()
			return React.createElement('StateProbe', {
				profilesCount: bootstrap.profiles.length,
				hasSchedule: bootstrap.schedule != null,
			})
		}

		await act(async () => {
			create(
				React.createElement(
					AppBootstrapProvider,
					null,
					React.createElement(Probe),
				),
			)
			await flushAsyncEffects()
		})

		const schedule = createWorkScheduleFromPreset({
			preset: requireSchedulePreset('2-2'),
			startDate: '2026-09-16',
			shiftTypes: DEFAULT_SHIFT_TYPES,
		})
		await act(async () => {
			await bootstrap!.persistSchedule(schedule)
		})

		expect(bootstrap!.profiles).toHaveLength(1)
		expect(bootstrap!.primaryProfile?.schedule).toEqual(schedule)
		expect(bootstrap!.schedule).toEqual(schedule)
		expect(saveProfiles).toHaveBeenCalledWith(
		 expect.arrayContaining([
			 expect.objectContaining({
				isPrimary: true,
				schedule,
			}),
		 ]),
		)
	})
})
