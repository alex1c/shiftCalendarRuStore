/**
 * Sticky banner slot pinned via Screen `footer` (outside ScrollView).
 * Safe-area padding keeps ads above the tab bar / system navigation.
 *
 * Load policy lives in `bannerFocusSession` so a no-fill while focused
 * never auto-retries until a real blur → focus cycle.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import {
	Dimensions,
	StyleSheet,
	View,
	type StyleProp,
	type ViewStyle,
} from 'react-native'
import {
	useFocusEffect,
	useIsFocused,
} from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { spacing } from '@/src/theme'

import {
	resolveBannerUnitId,
	type BannerPlacement,
} from './adsConfig'
import { createBannerFocusSession } from './bannerFocusSession'
import { useAds } from './AdsProvider'
import { loadYandexAds } from './yandexAdsNative'

type BannerAdSlotProps = {
	placement: BannerPlacement
	style?: StyleProp<ViewStyle>
	/**
	 * When true (default for tab screens), add only a small gap above the
	 * tab bar — the tab navigator already owns the bottom system inset.
	 * When false, add full bottom safe-area padding (non-tab surfaces).
	 */
	aboveTabBar?: boolean
}

export function BannerAdSlot ({
	placement,
	style,
	aboveTabBar = true,
}: BannerAdSlotProps) {
	const insets = useSafeAreaInsets()
	const isFocused = useIsFocused()
	const { ready, sdkAvailable } = useAds()
	const sessionRef = useRef(createBannerFocusSession())
	const [adSize, setAdSize] = useState<unknown>(null)
	const [failed, setFailed] = useState(false)
	const [loaded, setLoaded] = useState(false)
	const [requestKey, setRequestKey] = useState(0)
	// Bumped only on real focus entries that may start a load (not on failed).
	const [focusEpoch, setFocusEpoch] = useState(0)
	const unitId = resolveBannerUnitId(placement)

	// Empty deps: only real navigation focus / blur may drive retry.
	// Do NOT depend on `failed` — that re-created the infinite retry loop.
	useFocusEffect(
		useCallback(() => {
			const plan = sessionRef.current.onFocus()
			if (plan.retriedAfterBlur) {
				setFailed(false)
				setLoaded(false)
				setAdSize(null)
				setRequestKey(plan.requestKey)
			}
			if (plan.shouldStartLoad) {
				// Synchronize with session.onFocus before the load effect runs.
				setFocusEpoch((value) => value + 1)
			}
			return () => {
				sessionRef.current.onBlur()
			}
		}, []),
	)

	// Dispose the session on unmount so late async callbacks are ignored.
	useEffect(() => {
		const session = sessionRef.current
		return () => {
			session.dispose()
		}
	}, [])

	useEffect(() => {
		let cancelled = false
		if (!ready || !sdkAvailable || focusEpoch === 0) {
			return
		}
		const session = sessionRef.current
		if (!session.canStartLoad()) {
			return
		}
		const sdk = loadYandexAds()
		if (!sdk) {
			return
		}
		if (!session.markLoadStarted()) {
			return
		}

		// Sticky banners are full-bleed in Screen.footer (no horizontal pad).
		const width = Math.floor(Dimensions.get('window').width)
		const activeRequestKey = session.getRequestKey()
		void (async () => {
			try {
				const size = await sdk.BannerAdSize.stickySize(width)
				if (
					cancelled ||
					session.isDisposed() ||
					session.getRequestKey() !== activeRequestKey
				) {
					return
				}
				setAdSize(size)
			} catch (error) {
				if (__DEV__) {
					console.warn(
						`[AdsBanner] stickySize failed placement=${placement} unit=${unitId}`,
						error,
					)
				}
				if (
					cancelled ||
					session.isDisposed() ||
					session.getRequestKey() !== activeRequestKey
				) {
					return
				}
				session.markLoadFailed()
				setFailed(true)
			}
		})()
		return () => {
			cancelled = true
		}
	}, [
		focusEpoch,
		placement,
		ready,
		requestKey,
		sdkAvailable,
		unitId,
	])

	// Ads must never block layout — render nothing until focused + sized.
	// Blurred tabs return null so one shared unit ID has one live BannerView.
	if (!isFocused || !ready || !sdkAvailable || failed || !adSize) {
		return null
	}

	const sdk = loadYandexAds()
	if (!sdk) {
		return null
	}

	const BannerView = sdk.BannerView
	const bottomPad = aboveTabBar
		? spacing.sm
		: Math.max(insets.bottom, spacing.md) + spacing.sm
	const activeRequestKey = requestKey

	return (
		<View
			pointerEvents="box-none"
			style={[
				styles.wrap,
				{
					paddingBottom: bottomPad,
					paddingTop: spacing.xs,
				},
				style,
			]}
			accessibilityElementsHidden={!loaded}
			importantForAccessibility={
				loaded ? 'yes' : 'no-hide-descendants'
			}
		>
			{/*
			 * key forces a fresh native request after blur→focus retry
			 * without leaving a dead failed instance.
			 */}
			<BannerView
				key={`${placement}-${unitId}-${requestKey}`}
				size={adSize}
				adRequest={{ adUnitId: unitId }}
				onAdLoaded={() => {
					const session = sessionRef.current
					if (
						session.isDisposed() ||
						session.getRequestKey() !== activeRequestKey
					) {
						return
					}
					if (__DEV__) {
						console.log(
							`[AdsBanner] loaded placement=${placement} unit=${unitId}`,
						)
					}
					session.markLoadSucceeded()
					setLoaded(true)
				}}
				onAdFailedToLoad={(event) => {
					const session = sessionRef.current
					if (
						session.isDisposed() ||
						session.getRequestKey() !== activeRequestKey
					) {
						return
					}
					if (__DEV__) {
						console.warn(
							`[AdsBanner] failed placement=${placement} unit=${unitId}`,
							event,
						)
					}
					session.markLoadFailed()
					setFailed(true)
					setLoaded(false)
				}}
				style={styles.banner}
			/>
		</View>
	)
}

const styles = StyleSheet.create({
	wrap: {
		width: '100%',
		alignItems: 'center',
		justifyContent: 'center',
		// Reserve a reasonable sticky-banner strip so layout does not collapse
		// to zero height while the native view mounts.
		minHeight: 50,
	},
	banner: {
		width: '100%',
		alignSelf: 'center',
	},
})
