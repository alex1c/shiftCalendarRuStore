/**
 * Native adapter for local shift reminders.
 *
 * Screens and domain code must not import `expo-notifications` directly.
 * This module owns permissions, the Android channel, schedule/cancel,
 * and opening system settings. Exact alarms are intentionally unused.
 */

import { Linking, Platform } from 'react-native'
import * as Notifications from 'expo-notifications'

import {
	SHIFT_REMINDER_TYPE,
	type ShiftNotificationPlanItem,
} from '@/src/domain'

export const SHIFT_REMINDERS_CHANNEL_ID = 'shift_reminders'

export type NotificationPermissionStatus =
	| 'notDetermined'
	| 'granted'
	| 'denied'

let handlerConfigured = false

/**
 * Foreground presentation: a banner is enough. This is a reminder, not
 * an alarm clock — no sound escalation, no badge spam.
 */
export function configureNotificationHandling (): void {
	if (handlerConfigured) {
		return
	}
	handlerConfigured = true
	Notifications.setNotificationHandler({
		handleNotification: async () => ({
			shouldPlaySound: false,
			shouldSetBadge: false,
			shouldShowBanner: true,
			shouldShowList: true,
		}),
	})
}

function mapPermissionStatus (
	status: Notifications.PermissionStatus | string,
): NotificationPermissionStatus {
	if (status === 'granted') {
		return 'granted'
	}
	if (status === 'undetermined') {
		return 'notDetermined'
	}
	return 'denied'
}

/** Read the OS permission. Never persist this — the system is the source. */
export async function getNotificationPermissionStatus (): Promise<NotificationPermissionStatus> {
	configureNotificationHandling()
	try {
		const current = await Notifications.getPermissionsAsync()
		return mapPermissionStatus(current.status)
	} catch (error) {
		console.warn('[notifications] permission read failed', error)
		return 'denied'
	}
}

/**
 * Create the Android channel before prompting on API 33+. Channel
 * existence is what lets the system show POST_NOTIFICATIONS.
 */
export async function ensureShiftReminderChannel (): Promise<void> {
	if (Platform.OS !== 'android') {
		return
	}
	configureNotificationHandling()
	await Notifications.setNotificationChannelAsync(
		SHIFT_REMINDERS_CHANNEL_ID,
		{
			name: 'Напоминания о сменах',
			description: 'Уведомления о предстоящих рабочих сменах',
			importance: Notifications.AndroidImportance.DEFAULT,
			bypassDnd: false,
			lockscreenVisibility:
				Notifications.AndroidNotificationVisibility.PRIVATE,
			showBadge: false,
			enableVibrate: true,
			enableLights: false,
		},
	)
}

/**
 * Request permission only from notDetermined. After a deny, the UI must
 * send the user to system settings instead of looping the prompt.
 */
export async function requestNotificationPermission (): Promise<NotificationPermissionStatus> {
	configureNotificationHandling()
	try {
		await ensureShiftReminderChannel()
		const existing = await Notifications.getPermissionsAsync()
		const mapped = mapPermissionStatus(existing.status)
		if (mapped !== 'notDetermined') {
			return mapped
		}
		const asked = await Notifications.requestPermissionsAsync()
		return mapPermissionStatus(asked.status)
	} catch (error) {
		console.warn('[notifications] permission request failed', error)
		return 'denied'
	}
}

export async function openNotificationSettings (): Promise<void> {
	try {
		await Linking.openSettings()
	} catch (error) {
		console.warn('[notifications] open settings failed', error)
	}
}

function isShiftReminderNotification (
	request: Notifications.NotificationRequest,
): boolean {
	const data = request.content.data
	if (!data || typeof data !== 'object') {
		return request.identifier.startsWith('shift_reminder_')
	}
	const type = (data as { type?: unknown }).type
	return (
		type === SHIFT_REMINDER_TYPE ||
		request.identifier.startsWith('shift_reminder_')
	)
}

/** Drop previously scheduled shift reminders so reschedule cannot duplicate. */
export async function cancelShiftReminderNotifications (): Promise<void> {
	configureNotificationHandling()
	try {
		const pending = await Notifications.getAllScheduledNotificationsAsync()
		const ours = pending.filter(isShiftReminderNotification)
		for (const item of ours) {
			await Notifications.cancelScheduledNotificationAsync(item.identifier)
		}
	} catch (error) {
		console.warn('[notifications] cancel pending failed', error)
		try {
			await Notifications.cancelAllScheduledNotificationsAsync()
		} catch (fallbackError) {
			console.warn(
				'[notifications] cancel-all fallback failed',
				fallbackError,
			)
		}
	}
}

/** Schedule each plan row with its deterministic identifier. */
export async function scheduleShiftReminderPlan (
	plan: readonly ShiftNotificationPlanItem[],
): Promise<void> {
	configureNotificationHandling()
	await ensureShiftReminderChannel()
	for (const item of plan) {
		await Notifications.scheduleNotificationAsync({
			identifier: item.key,
			content: {
				title: item.title,
				body: item.body,
				data: item.data,
				sound: false,
			},
			trigger: {
				type: Notifications.SchedulableTriggerInputTypes.DATE,
				date: item.triggerAt,
				channelId: SHIFT_REMINDERS_CHANNEL_ID,
			},
		})
	}
}
