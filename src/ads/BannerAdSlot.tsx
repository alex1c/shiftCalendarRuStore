/**
 * Sticky banner slot pinned via Screen `footer` (outside ScrollView).
 * Safe-area padding keeps ads above the tab bar / system navigation.
 */

import { useCallback, useEffect, useState } from 'react'
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
	const [adSize, setAdSize] = useState<unknown>(null)
	const [failed, setFailed] = useState(false)
	const [loaded, setLoaded] = useState(false)
	const [requestKey, setRequestKey] = useState(0)
	const unitId = resolveBannerUnitId(placement)

	// Soft retry when returning to a tab after a prior no-fill / load error.
	// Only one retry per focus — never loop while the screen stays focused.
	useFocusEffect(
		useCallback(() => {
			if (failed) {
				setFailed(false)
				setLoaded(false)
				setAdSize(null)
				setRequestKey((value) => value + 1)
			}
		}, [failed]),
	)

	useEffect(() => {
		let cancelled = false
		// Skip work on blurred tabs so shared production unit IDs do not
		// keep multiple native BannerView instances alive at once.
		if (!isFocused || !ready || !sdkAvailable || failed) {
			return
		}
		const sdk = loadYandexAds()
		if (!sdk) {
			return
		}
		// Sticky banners are full-bleed in Screen.footer (no horizontal pad).
		const width = Math.floor(Dimensions.get('window').width)
		void (async () => {
			try {
				const size = await sdk.BannerAdSize.stickySize(width)
				if (!cancelled) {
					setAdSize(size)
				}
			} catch (error) {
				if (__DEV__) {
					console.warn(
						`[AdsBanner] stickySize failed placement=${placement} unit=${unitId}`,
						error,
					)
				}
				if (!cancelled) {
					setFailed(true)
				}
			}
		})()
		return () => {
			cancelled = true
		}
	}, [
		failed,
		isFocused,
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
			 * key forces a fresh native request after focus retry
			 * (requestKey bump) without leaving a dead failed instance.
			 */}
			<BannerView
				key={`${placement}-${unitId}-${requestKey}`}
				size={adSize}
				adRequest={{ adUnitId: unitId }}
				onAdLoaded={() => {
					if (__DEV__) {
						console.log(
							`[AdsBanner] loaded placement=${placement} unit=${unitId}`,
						)
					}
					setLoaded(true)
				}}
				onAdFailedToLoad={(event) => {
					if (__DEV__) {
						console.warn(
							`[AdsBanner] failed placement=${placement} unit=${unitId}`,
							event,
						)
					}
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
