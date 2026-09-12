/**
 * Marks a screen as an ads-protected flow while focused
 * (backup, notifications, day edit, salary, PDF in-progress).
 */

import { useCallback, useEffect } from 'react'
import { useFocusEffect } from '@react-navigation/native'

import { useAds } from './AdsProvider'

/**
 * Hook: while the host screen is focused, interstitial ads are blocked.
 */
export function useAdsProtectedFlow (): void {
	const { enterProtected, exitProtected } = useAds()

	useFocusEffect(
		useCallback(() => {
			enterProtected()
			return () => {
				exitProtected()
			}
		}, [enterProtected, exitProtected]),
	)
}

/**
 * Hook: temporarily protect while `active` is true (e.g. PDF sharing).
 */
export function useAdsProtectionFlag (active: boolean): void {
	const { enterProtected, exitProtected } = useAds()

	useEffect(() => {
		if (!active) {
			return
		}
		enterProtected()
		return () => {
			exitProtected()
		}
	}, [active, enterProtected, exitProtected])
}
