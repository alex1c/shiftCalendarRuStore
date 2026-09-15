/**
 * One-shot UI discovery hints — separate from schedule / backup data.
 * Versioned AsyncStorage document; never contains user PII.
 */

import AsyncStorage from '@react-native-async-storage/async-storage'

export const UI_HINTS_SCHEMA_VERSION = 1
export const UI_HINTS_STORAGE_KEY = '@shiftcalendar/uiHints'

export type UiHintsState = {
	schemaVersion: number
	combinedHintDismissed: boolean
	shareHintDismissed: boolean
	/** Soft tip after first schedule pointing to Learning. */
	learningTipShown: boolean
	/** Calendar tab focus count for delayed share discoverability. */
	calendarVisitCount: number
}

export const DEFAULT_UI_HINTS: UiHintsState = {
	schemaVersion: UI_HINTS_SCHEMA_VERSION,
	combinedHintDismissed: false,
	shareHintDismissed: false,
	learningTipShown: false,
	calendarVisitCount: 0,
}

function isUiHintsState (value: unknown): value is UiHintsState {
	if (value == null || typeof value !== 'object') {
		return false
	}
	const row = value as Record<string, unknown>
	return (
		typeof row.schemaVersion === 'number' &&
		typeof row.combinedHintDismissed === 'boolean' &&
		typeof row.shareHintDismissed === 'boolean' &&
		typeof row.learningTipShown === 'boolean' &&
		typeof row.calendarVisitCount === 'number'
	)
}

export function normalizeUiHints (value: unknown): UiHintsState {
	if (!isUiHintsState(value)) {
		return { ...DEFAULT_UI_HINTS }
	}
	return {
		schemaVersion: UI_HINTS_SCHEMA_VERSION,
		combinedHintDismissed: value.combinedHintDismissed,
		shareHintDismissed: value.shareHintDismissed,
		learningTipShown: value.learningTipShown,
		calendarVisitCount: Math.max(0, Math.floor(value.calendarVisitCount)),
	}
}

export async function getUiHints (): Promise<UiHintsState> {
	try {
		const raw = await AsyncStorage.getItem(UI_HINTS_STORAGE_KEY)
		if (!raw) {
			return { ...DEFAULT_UI_HINTS }
		}
		return normalizeUiHints(JSON.parse(raw) as unknown)
	} catch {
		return { ...DEFAULT_UI_HINTS }
	}
}

export async function saveUiHints (next: UiHintsState): Promise<void> {
	const normalized = normalizeUiHints(next)
	await AsyncStorage.setItem(
		UI_HINTS_STORAGE_KEY,
		JSON.stringify(normalized),
	)
}

export async function dismissCombinedHint (): Promise<void> {
	const current = await getUiHints()
	await saveUiHints({ ...current, combinedHintDismissed: true })
}

export async function dismissShareHint (): Promise<void> {
	const current = await getUiHints()
	await saveUiHints({ ...current, shareHintDismissed: true })
}

export async function markLearningTipShown (): Promise<void> {
	const current = await getUiHints()
	await saveUiHints({ ...current, learningTipShown: true })
}

/**
 * Increment calendar visits and return whether the share hint should show.
 * Threshold: second visit (after onboarding settles into calendar use).
 */
export async function recordCalendarVisitForShareHint (): Promise<{
	shouldShowShareHint: boolean
	hints: UiHintsState
}> {
	const current = await getUiHints()
	if (current.shareHintDismissed) {
		return { shouldShowShareHint: false, hints: current }
	}
	const next: UiHintsState = {
		...current,
		calendarVisitCount: current.calendarVisitCount + 1,
	}
	await saveUiHints(next)
	// Show exactly once when the delayed threshold is first reached.
	const shouldShowShareHint =
		!current.shareHintDismissed && next.calendarVisitCount === 2
	return { shouldShowShareHint, hints: next }
}

/**
 * Whether the combined-calendar hint may be shown after adding a second
 * schedule. Does not auto-dismiss — caller must call dismissCombinedHint.
 */
export async function shouldShowCombinedHint (): Promise<boolean> {
	const hints = await getUiHints()
	return !hints.combinedHintDismissed
}

export async function shouldShowLearningTip (): Promise<boolean> {
	const hints = await getUiHints()
	return !hints.learningTipShown
}
