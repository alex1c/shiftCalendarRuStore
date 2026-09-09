/**
 * In-memory custom-cycle draft for the onboarding stack.
 * Lives only while onboarding is mounted; persistence happens on confirm.
 */

import {
	createContext,
	useCallback,
	useContext,
	useMemo,
	useRef,
	useState,
	type ReactNode,
} from 'react'

import {
	appendCycleItem,
	createEmptyCustomDraft,
	duplicateCycleItem,
	moveCycleItem,
	removeCycleItem,
	replaceCycleItem,
	upsertShiftType,
	type CustomCycleDraft,
	type ValidationResult,
} from '@/src/domain'
import type { ShiftType } from '@/src/types'

type DraftMutation = ValidationResult<{ cycle: string[] }>

type OnboardingDraftValue = {
	draft: CustomCycleDraft
	resetDraft: () => void
	setName: (name: string) => void
	addShift: (shiftTypeId: string) => DraftMutation
	addCustomShift: (shift: ShiftType) => DraftMutation
	updateShiftType: (shift: ShiftType) => void
	removeAt: (index: number) => void
	moveAt: (index: number, direction: -1 | 1) => void
	duplicateAt: (index: number) => DraftMutation
	replaceAt: (index: number, shiftTypeId: string) => void
	replaceAtWithCustom: (index: number, shift: ShiftType) => void
}

const OnboardingDraftContext = createContext<OnboardingDraftValue | null>(null)

type OnboardingDraftProviderProps = {
	children: ReactNode
}

export function OnboardingDraftProvider ({
	children,
}: OnboardingDraftProviderProps) {
	const [draft, setDraft] = useState<CustomCycleDraft>(createEmptyCustomDraft)
	const draftRef = useRef(draft)

	const commitDraft = useCallback(
		(updater: (current: CustomCycleDraft) => CustomCycleDraft) => {
			const next = updater(draftRef.current)
			draftRef.current = next
			setDraft(next)
		},
		[],
	)

	const resetDraft = useCallback(() => {
		commitDraft(() => createEmptyCustomDraft())
	}, [commitDraft])

	const setName = useCallback((name: string) => {
		commitDraft((current) => ({ ...current, name }))
	}, [commitDraft])

	const addShift = useCallback((shiftTypeId: string): DraftMutation => {
		let result: DraftMutation = { ok: false, message: 'Не удалось добавить смену.' }
		commitDraft((current) => {
			result = appendCycleItem(current.cycle, shiftTypeId)
			if (!result.ok) {
				return current
			}
			return { ...current, cycle: result.cycle }
		})
		return result
	}, [commitDraft])

	const addCustomShift = useCallback((shift: ShiftType): DraftMutation => {
		let result: DraftMutation = { ok: false, message: 'Не удалось добавить смену.' }
		commitDraft((current) => {
			result = appendCycleItem(current.cycle, shift.id)
			if (!result.ok) {
				return current
			}
			return {
				...current,
				cycle: result.cycle,
				shiftTypes: upsertShiftType(current.shiftTypes, shift),
			}
		})
		return result
	}, [commitDraft])

	const updateShiftType = useCallback((shift: ShiftType) => {
		commitDraft((current) => ({
			...current,
			shiftTypes: upsertShiftType(current.shiftTypes, shift),
		}))
	}, [commitDraft])

	const removeAt = useCallback((index: number) => {
		commitDraft((current) => ({
			...current,
			cycle: removeCycleItem(current.cycle, index),
		}))
	}, [commitDraft])

	const moveAt = useCallback((index: number, direction: -1 | 1) => {
		commitDraft((current) => ({
			...current,
			cycle: moveCycleItem(current.cycle, index, direction),
		}))
	}, [commitDraft])

	const duplicateAt = useCallback((index: number): DraftMutation => {
		let result: DraftMutation = { ok: false, message: 'Не удалось скопировать смену.' }
		commitDraft((current) => {
			result = duplicateCycleItem(current.cycle, index)
			if (!result.ok) {
				return current
			}
			return { ...current, cycle: result.cycle }
		})
		return result
	}, [commitDraft])

	const replaceAt = useCallback((index: number, shiftTypeId: string) => {
		commitDraft((current) => ({
			...current,
			cycle: replaceCycleItem(current.cycle, index, shiftTypeId),
		}))
	}, [commitDraft])

	const replaceAtWithCustom = useCallback((index: number, shift: ShiftType) => {
		commitDraft((current) => ({
			...current,
			cycle: replaceCycleItem(current.cycle, index, shift.id),
			shiftTypes: upsertShiftType(current.shiftTypes, shift),
		}))
	}, [commitDraft])

	const value = useMemo(
		() => ({
			draft,
			resetDraft,
			setName,
			addShift,
			addCustomShift,
			updateShiftType,
			removeAt,
			moveAt,
			duplicateAt,
			replaceAt,
			replaceAtWithCustom,
		}),
		[
			draft,
			resetDraft,
			setName,
			addShift,
			addCustomShift,
			updateShiftType,
			removeAt,
			moveAt,
			duplicateAt,
			replaceAt,
			replaceAtWithCustom,
		],
	)

	return (
		<OnboardingDraftContext.Provider value={value}>
			{children}
		</OnboardingDraftContext.Provider>
	)
}

export function useOnboardingDraft (): OnboardingDraftValue {
	const value = useContext(OnboardingDraftContext)
	if (!value) {
		throw new Error('useOnboardingDraft must be used inside OnboardingDraftProvider')
	}
	return value
}
