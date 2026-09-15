/**
 * One-shot UI hint persistence — separate from schedule data.
 */

import AsyncStorage from '@react-native-async-storage/async-storage'

import {
	DEFAULT_UI_HINTS,
	UI_HINTS_STORAGE_KEY,
	dismissCombinedHint,
	dismissShareHint,
	getUiHints,
	markLearningTipShown,
	normalizeUiHints,
	recordCalendarVisitForShareHint,
	saveUiHints,
	shouldShowCombinedHint,
	shouldShowLearningTip,
} from '@/src/learning/uiHints'

describe('ui hints persistence', () => {
	beforeEach(async () => {
		await AsyncStorage.clear()
	})

	it('starts with dismissed flags false and no sensitive fields', () => {
		const hints = normalizeUiHints(undefined)
		expect(hints).toEqual(DEFAULT_UI_HINTS)
		expect(JSON.stringify(hints)).not.toMatch(
			/name|salary|notes|schedule|date/i,
		)
	})

	it('persists combined hint dismiss so it only shows once', async () => {
		expect(await shouldShowCombinedHint()).toBe(true)
		await dismissCombinedHint()
		expect(await shouldShowCombinedHint()).toBe(false)
		const stored = await getUiHints()
		expect(stored.combinedHintDismissed).toBe(true)
	})

	it('shows share hint once on the second calendar visit', async () => {
		const first = await recordCalendarVisitForShareHint()
		expect(first.shouldShowShareHint).toBe(false)
		expect(first.hints.calendarVisitCount).toBe(1)

		const second = await recordCalendarVisitForShareHint()
		expect(second.shouldShowShareHint).toBe(true)
		expect(second.hints.calendarVisitCount).toBe(2)

		await dismissShareHint()
		const third = await recordCalendarVisitForShareHint()
		expect(third.shouldShowShareHint).toBe(false)
	})

	it('marks learning tip as shown without touching schedule keys', async () => {
		expect(await shouldShowLearningTip()).toBe(true)
		await markLearningTipShown()
		expect(await shouldShowLearningTip()).toBe(false)
		const keys = await AsyncStorage.getAllKeys()
		expect(keys).toContain(UI_HINTS_STORAGE_KEY)
		expect(keys.some((key) => key.includes('schedule'))).toBe(false)
	})

	it('round-trips saveUiHints', async () => {
		await saveUiHints({
			...DEFAULT_UI_HINTS,
			combinedHintDismissed: true,
			calendarVisitCount: 4,
		})
		const loaded = await getUiHints()
		expect(loaded.combinedHintDismissed).toBe(true)
		expect(loaded.calendarVisitCount).toBe(4)
	})
})
