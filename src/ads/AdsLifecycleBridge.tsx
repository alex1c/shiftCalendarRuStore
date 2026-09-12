/**
 * Sync ads session flags with bootstrap / navigation lifecycle.
 */

import { useEffect } from 'react'

import { useAds } from '@/src/ads'
import { useAppBootstrap } from '@/src/features/bootstrap/AppBootstrap'

/**
 * Keeps onboarding + first-main flags aligned with persisted schedule state.
 * Must render under AdsProvider and AppBootstrapProvider.
 */
export function AdsLifecycleBridge () {
	const { schedule, ready } = useAppBootstrap()
	const { setOnboarding, markMainReached } = useAds()

	useEffect(() => {
		if (!ready) {
			return
		}
		const onboarding = schedule == null
		setOnboarding(onboarding)
		if (!onboarding) {
			void markMainReached()
		}
	}, [markMainReached, ready, schedule, setOnboarding])

	return null
}
