/**
 * In-memory custom-cycle draft for the onboarding stack.
 * Lives only while onboarding is mounted; persistence happens on confirm.
 */

import {
	createContext,
	useCallback,
	useContext,
	useMemo,
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

	const resetDraft = useCallback(() => {
		setDraft(createEmptyCustomDraft())
	}, [])

	const setName = useCallback((name: string) => {
		setDraft((current) => ({ ...current, name }))
	}, [])

	const addShift = useCallback((shiftTypeId: string): DraftMutation => {
		let result: DraftMutation = { ok: false, message: 'Не удалось добавить смену.' }
		setDraft((current) => {
			result = appendCycleItem(current.cycle, shiftTypeId)
			if (!result.ok) {
				return current
			}
			return { ...current, cycle: result.cycle }
		})
		return result
	}, [])

	const addCustomShift = useCallback((shift: ShiftType): DraftMutation => {
		let result: DraftMutation = { ok: false, message: 'Не удалось добавить смену.' }
		setDraft((current) => {
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
	}, [])

	const updateShiftType = useCallback((shift: ShiftType) => {
		setDraft((current) => ({
			...current,
			shiftTypes: upsertShiftType(current.shiftTypes, shift),
		}))
	}, [])

	const removeAt = useCallback((index: number) => {
		setDraft((current) => ({
			...current,
			cycle: removeCycleItem(current.cycle, index),
		}))
	}, [])

	const moveAt = useCallback((index: number, direction: -1 | 1) => {
		setDraft((current) => ({
			...current,
			cycle: moveCycleItem(current.cycle, index, direction),
		}))
	}, [])

	const duplicateAt = useCallback((index: number): DraftMutation => {
		let result: DraftMutation = { ok: false, message: 'Не удалось скопировать смену.' }
		setDraft((current) => {
			result = duplicateCycleItem(current.cycle, index)
			if (!result.ok) {
				return current
			}
			return { ...current, cycle: result.cycle }
		})
		return result
	}, [])

	const replaceAt = useCallback((index: number, shiftTypeId: string) => {
		setDraft((current) => ({
			...current,
			cycle: replaceCycleItem(current.cycle, index, shiftTypeId),
		}))
	}, [])

	const replaceAtWithCustom = useCallback((index: number, shift: ShiftType) => {
		setDraft((current) => ({
			...current,
			cycle: replaceCycleItem(current.cycle, index, shift.id),
			shiftTypes: upsertShiftType(current.shiftTypes, shift),
		}))
	}, [])

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
