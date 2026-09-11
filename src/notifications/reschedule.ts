/**
 * Single entry that rebuilds pending shift reminders.
 *
 * Algorithm: cancel our pending notifications, compute the pure 30-day
 * plan for the primary profile, skip past triggers, then schedule.
 * UI must call this after a save — never from render.
 *
 * Reboot: Expo local notifications are not guaranteed to survive a
 * device restart without a native boot receiver. The next app launch
 * re-runs this function when reminders are enabled and permission is
 * granted. Do not treat reboot restore as a Phase 9 guarantee.
 */

import {
	buildNotificationPlan,
	defaultNotificationSettings,
	type NotificationSettings,
	type ScheduleProfile,
	type ShiftNotificationPlanItem,
} from '@/src/domain'
import {
	cancelShiftReminderNotifications,
	configureNotificationHandling,
	getNotificationPermissionStatus,
	scheduleShiftReminderPlan,
} from './NotificationService'

export type RescheduleShiftNotificationsInput = {
	profiles: readonly ScheduleProfile[]
	settings: NotificationSettings | null
	now?: Date
}

let rescheduleChain: Promise<ShiftNotificationPlanItem[]> = Promise.resolve([])

async function runReschedule (
	input: RescheduleShiftNotificationsInput,
): Promise<ShiftNotificationPlanItem[]> {
	configureNotificationHandling()
	const settings =
		input.settings ?? defaultNotificationSettings(input.now ?? new Date())
	try {
		await cancelShiftReminderNotifications()
		if (!settings.enabled) {
			return []
		}
		const permission = await getNotificationPermissionStatus()
		if (permission !== 'granted') {
			return []
		}
		const plan = buildNotificationPlan({
			profiles: input.profiles,
			settings,
			now: input.now ?? new Date(),
		})
		await scheduleShiftReminderPlan(plan)
		return plan
	} catch (error) {
		console.warn('[notifications] reschedule failed', error)
		return []
	}
}

/**
 * Cancel + rebuild pending shift reminders. Errors are swallowed so a
 * native API failure cannot crash app launch or a schedule save.
 * Concurrent calls are serialized to avoid duplicate schedules.
 */
export function rescheduleShiftNotifications (
	input: RescheduleShiftNotificationsInput,
): Promise<ShiftNotificationPlanItem[]> {
	const next = rescheduleChain.then(
		() => runReschedule(input),
		() => runReschedule(input),
	)
	rescheduleChain = next
	return next
}
