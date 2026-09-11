/**
 * Public notification adapter. Domain planning lives in `src/domain`.
 */

export {
	SHIFT_REMINDERS_CHANNEL_ID,
	cancelShiftReminderNotifications,
	configureNotificationHandling,
	ensureShiftReminderChannel,
	getNotificationPermissionStatus,
	openNotificationSettings,
	requestNotificationPermission,
	scheduleShiftReminderPlan,
	type NotificationPermissionStatus,
} from './NotificationService'
export { rescheduleShiftNotifications } from './reschedule'
