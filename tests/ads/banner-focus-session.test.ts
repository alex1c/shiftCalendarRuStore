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

		// First focus + success
		session.onFocus()
		expect(session.markLoadStarted()).toBe(true)
		session.markLoadSucceeded()
		session.onBlur()

		// Return after success: remount BannerView from React state, no new load.
		const backAfterSuccess = session.onFocus()
		expect(backAfterSuccess.shouldStartLoad).toBe(false)
		expect(session.canStartLoad()).toBe(false)
		expect(session.markLoadStarted()).toBe(false)
		expect(session.getLoadStartCount()).toBe(1)
		session.onBlur()

		// Failure path then blur → focus → exactly one retry
		// (simulate a later failure by forcing a retry cycle via dispose-less fail)
		const session2 = createBannerFocusSession()
		session2.onFocus()
		expect(session2.markLoadStarted()).toBe(true)
		session2.markLoadFailed()
		session2.onBlur()
		const retry = session2.onFocus()
		expect(retry.retriedAfterBlur).toBe(true)
		expect(session2.markLoadStarted()).toBe(true)
		expect(session2.getLoadStartCount()).toBe(2)

		// Instant spurious focus while focused (deps churn)
		expect(session2.onFocus().shouldStartLoad).toBe(false)
		expect(session2.markLoadStarted()).toBe(false)
		expect(session2.getLoadStartCount()).toBe(2)
	})
})
