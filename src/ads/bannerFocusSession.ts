/**
 * Focus-session policy for sticky banner loads.
 *
 * Critical invariant: a failure while focused must NOT schedule another
 * request until a real blur → focus cycle. React Navigation can re-run
 * focus effects when callback identities change; those must be no-ops.
 */

export type BannerFocusPlan = {
	/** True only on a real focus entry that should (re)start a load. */
	shouldStartLoad: boolean
	/** Monotonic request id for remounting the native BannerView. */
	requestKey: number
	/** True when this focus entry cleared a prior failure for retry. */
	retriedAfterBlur: boolean
}

export type BannerFocusSession = {
	onFocus: () => BannerFocusPlan
	onBlur: () => void
	markLoadStarted: () => boolean
	markLoadSucceeded: () => void
	markLoadFailed: () => void
	dispose: () => void
	canStartLoad: () => boolean
	getRequestKey: () => number
	getLoadStartCount: () => number
	isDisposed: () => boolean
	isFocused: () => boolean
	hasFailed: () => boolean
}

/**
 * Create an isolated focus/load session controller (one per BannerAdSlot).
 */
export function createBannerFocusSession (): BannerFocusSession {
	let focused = false
	let failed = false
	let disposed = false
	let requestKey = 0
	let loadStartCount = 0
	/** Tracks whether the current focus entry already opened a load attempt. */
	let loadStartedThisFocus = false
	/**
	 * True until the first successful size/ad path completes, or after a
	 * blur→focus retry clears a failure. Returning to a tab after success
	 * reuses React state / remounts BannerView without a new stickySize call.
	 */
	let needsLoad = true

	return {
		onFocus (): BannerFocusPlan {
			if (disposed) {
				return {
					shouldStartLoad: false,
					requestKey,
					retriedAfterBlur: false,
				}
			}

			// Spurious re-entry while already focused (callback identity churn).
			if (focused) {
				return {
					shouldStartLoad: false,
					requestKey,
					retriedAfterBlur: false,
				}
			}

			focused = true
			let retriedAfterBlur = false

			if (failed) {
				// Real blur → focus after a failure: allow exactly one retry.
				failed = false
				requestKey += 1
				loadStartedThisFocus = false
				needsLoad = true
				retriedAfterBlur = true
			}

			const shouldStartLoad =
				needsLoad && !failed && !loadStartedThisFocus
			return { shouldStartLoad, requestKey, retriedAfterBlur }
		},

		onBlur (): void {
			if (disposed) {
				return
			}
			focused = false
			// Keep `failed` / `needsLoad` so the next real focus can decide.
			loadStartedThisFocus = false
		},

		markLoadStarted (): boolean {
			if (
				disposed ||
				!focused ||
				failed ||
				loadStartedThisFocus ||
				!needsLoad
			) {
				return false
			}
			loadStartedThisFocus = true
			loadStartCount += 1
			return true
		},

		markLoadSucceeded (): void {
			if (disposed) {
				return
			}
			failed = false
			needsLoad = false
		},

		markLoadFailed (): void {
			if (disposed) {
				return
			}
			failed = true
			needsLoad = false
		},

		dispose (): void {
			disposed = true
			focused = false
		},

		canStartLoad (): boolean {
			return (
				!disposed &&
				focused &&
				!failed &&
				!loadStartedThisFocus &&
				needsLoad
			)
		},

		getRequestKey: () => requestKey,
		getLoadStartCount: () => loadStartCount,
		isDisposed: () => disposed,
		isFocused: () => focused,
		hasFailed: () => failed,
	}
}
