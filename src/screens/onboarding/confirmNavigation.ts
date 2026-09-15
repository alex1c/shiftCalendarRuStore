/**
 * Navigation policy after schedule creation.
 * Hints must never own the completion navigation: native Alert callbacks can
 * run after the onboarding navigator has already been replaced.
 */

export type ConfirmCompletionNavigation = 'root-state' | 'parent-back'

export function getConfirmCompletionNavigation (
	profileCount: number,
): ConfirmCompletionNavigation {
	return profileCount === 0 ? 'root-state' : 'parent-back'
}
