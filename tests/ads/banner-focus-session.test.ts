/**
 * Banner focus-session policy — guards against infinite no-fill retries.
 */

import { createBannerFocusSession } from '@/src/ads/bannerFocusSession'

describe('bannerFocusSession', () => {
	it('first focus allows exactly one load start', () => {
		const session = createBannerFocusSession()
		const plan = session.onFocus()
		expect(plan.shouldStartLoad).toBe(true)
		expect(plan.retriedAfterBlur).toBe(false)
		expect(session.canStartLoad()).toBe(true)
		expect(session.markLoadStarted()).toBe(true)
		expect(session.getLoadStartCount()).toBe(1)
		// Same focus session cannot start another load.
		expect(session.canStartLoad()).toBe(false)
		expect(session.markLoadStarted()).toBe(false)
		expect(session.getLoadStartCount()).toBe(1)
	})

	it('no-fill does not immediately allow another load', () => {
		const session = createBannerFocusSession()
		session.onFocus()
		expect(session.markLoadStarted()).toBe(true)
		session.markLoadFailed()
		expect(session.hasFailed()).toBe(true)
		expect(session.canStartLoad()).toBe(false)
		expect(session.markLoadStarted()).toBe(false)
		expect(session.getLoadStartCount()).toBe(1)
	})

	it('multiple failures without blur do not start new requests', () => {
		const session = createBannerFocusSession()
		session.onFocus()
		expect(session.markLoadStarted()).toBe(true)
		session.markLoadFailed()
		session.markLoadFailed()
		session.markLoadFailed()
		// Spurious onFocus while still focused must be a no-op.
		const spurious = session.onFocus()
		expect(spurious.shouldStartLoad).toBe(false)
		expect(spurious.retriedAfterBlur).toBe(false)
		expect(session.markLoadStarted()).toBe(false)
		expect(session.getLoadStartCount()).toBe(1)
		expect(session.getRequestKey()).toBe(0)
	})

	it('blur then focus after failure starts exactly one retry', () => {
		const session = createBannerFocusSession()
		session.onFocus()
		expect(session.markLoadStarted()).toBe(true)
		session.markLoadFailed()
		session.onBlur()

		const retry = session.onFocus()
		expect(retry.retriedAfterBlur).toBe(true)
		expect(retry.requestKey).toBe(1)
		expect(session.canStartLoad()).toBe(true)
		expect(session.markLoadStarted()).toBe(true)
		expect(session.getLoadStartCount()).toBe(2)
		expect(session.markLoadStarted()).toBe(false)
	})

	it('unmount/dispose blocks further load starts and late failures', () => {
		const session = createBannerFocusSession()
		session.onFocus()
		expect(session.markLoadStarted()).toBe(true)
		session.dispose()
		expect(session.isDisposed()).toBe(true)
		expect(session.canStartLoad()).toBe(false)
		expect(session.markLoadStarted()).toBe(false)
		const afterDispose = session.onFocus()
		expect(afterDispose.shouldStartLoad).toBe(false)
		session.markLoadFailed()
		expect(session.getLoadStartCount()).toBe(1)
	})

	it('rapid tab switches keep a correct lifecycle', () => {
		const session = createBannerFocusSession()

		// Tab A focus + success
		session.onFocus()
		expect(session.markLoadStarted()).toBe(true)
		session.markLoadSucceeded()
		session.onBlur()

		// Tab B focus (simulated as same session returning)
		session.onFocus()
		// Success path: no failure, loadStartedThisFocus reset on blur,
		// so a new focus may start a fresh load for remount safety.
		expect(session.canStartLoad()).toBe(true)
		expect(session.markLoadStarted()).toBe(true)
		session.markLoadFailed()
		session.onBlur()

		// Back to tab quickly after failure → one retry only
		const retry = session.onFocus()
		expect(retry.retriedAfterBlur).toBe(true)
		expect(session.markLoadStarted()).toBe(true)
		expect(session.getLoadStartCount()).toBe(3)

		// Instant spurious focus while focused (deps churn)
		expect(session.onFocus().shouldStartLoad).toBe(false)
		expect(session.markLoadStarted()).toBe(false)
		expect(session.getLoadStartCount()).toBe(3)
	})
})
