/**
 * Analytics provider — activate AppMetrica (if key present) and track app_open.
 */

import { useEffect, type ReactNode } from 'react'

import { activateAnalytics, trackEvent } from './analytics'
import { ANALYTICS_EVENTS } from './events'

type AnalyticsProviderProps = {
	children: ReactNode
}

export function AnalyticsProvider ({ children }: AnalyticsProviderProps) {
	useEffect(() => {
		// Temporary DEV-only mount marker for device QA logcat.
		if (__DEV__) {
			console.log('[AnalyticsDebug] provider mounted')
		}
		activateAnalytics()
		trackEvent(ANALYTICS_EVENTS.appOpen)
	}, [])

	return children
}
