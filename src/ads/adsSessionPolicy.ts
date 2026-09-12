/**
 * Pure in-memory interstitial session policy (ForestMusic-safe UX).
 * No persistent aggressive counters — only a first-launch flag is persisted
 * outside this module by the caller.
 */

export type InterstitialTrigger =
	| 'statistics_viewed'
	| 'pdf_shared'
	| 'neutral_navigation'

export type AdsSessionState = {
	/** Epoch ms when the ads session started. */
	startedAt: number
	/** Soft interaction counter (tab focuses, completed neutral actions). */
	interactionCount: number
	/** Hard cap: at most one interstitial per process lifetime session. */
	interstitialShownThisSession: boolean
	/**
	 * True when this cold start is the user's first time reaching main UI.
	 * Interstitials are blocked for the entire first-launch session.
	 */
	isFirstLaunchSession: boolean
	/** Nested protected-flow depth (edit day, backup, salary, …). */
	protectedDepth: number
	/** True while onboarding / first-create flow is active. */
	isOnboardingActive: boolean
}

export type InterstitialDecision =
	| { allowed: true }
	| { allowed: false; reason: string }

/** Minimum wall-clock time in session before any interstitial. */
export const INTERSTITIAL_MIN_SESSION_MS = 90_000

/** Minimum soft interactions before any interstitial. */
export const INTERSTITIAL_MIN_INTERACTIONS = 4

export function createAdsSessionState (
	options: {
		now?: number
		isFirstLaunchSession?: boolean
	} = {},
): AdsSessionState {
	return {
		startedAt: options.now ?? Date.now(),
		interactionCount: 0,
		interstitialShownThisSession: false,
		isFirstLaunchSession: options.isFirstLaunchSession ?? false,
		protectedDepth: 0,
		isOnboardingActive: false,
	}
}

export function recordAdsInteraction (
	state: AdsSessionState,
	amount: number = 1,
): AdsSessionState {
	return {
		...state,
		interactionCount: state.interactionCount + amount,
	}
}

export function markInterstitialShown (
	state: AdsSessionState,
): AdsSessionState {
	return {
		...state,
		interstitialShownThisSession: true,
	}
}

export function enterProtectedFlow (
	state: AdsSessionState,
): AdsSessionState {
	return {
		...state,
		protectedDepth: state.protectedDepth + 1,
	}
}

export function exitProtectedFlow (
	state: AdsSessionState,
): AdsSessionState {
	return {
		...state,
		protectedDepth: Math.max(0, state.protectedDepth - 1),
	}
}

export function setOnboardingActive (
	state: AdsSessionState,
	active: boolean,
): AdsSessionState {
	return {
		...state,
		isOnboardingActive: active,
	}
}

/**
 * Decide whether an interstitial may show for a completed neutral action.
 */
export function evaluateInterstitialEligibility (
	state: AdsSessionState,
	trigger: InterstitialTrigger,
	now: number = Date.now(),
): InterstitialDecision {
	if (state.interstitialShownThisSession) {
		return { allowed: false, reason: 'already_shown_this_session' }
	}
	if (state.isFirstLaunchSession) {
		return { allowed: false, reason: 'first_launch_session' }
	}
	if (state.isOnboardingActive) {
		return { allowed: false, reason: 'onboarding_active' }
	}
	if (state.protectedDepth > 0) {
		return { allowed: false, reason: 'protected_flow' }
	}
	if (now - state.startedAt < INTERSTITIAL_MIN_SESSION_MS) {
		return { allowed: false, reason: 'session_too_short' }
	}
	if (state.interactionCount < INTERSTITIAL_MIN_INTERACTIONS) {
		return { allowed: false, reason: 'below_interaction_threshold' }
	}
	// Only allow known neutral completed-action triggers.
	if (
		trigger !== 'statistics_viewed' &&
		trigger !== 'pdf_shared' &&
		trigger !== 'neutral_navigation'
	) {
		return { allowed: false, reason: 'unsupported_trigger' }
	}
	return { allowed: true }
}
