/**
 * Sticky banner slot with safe-area padding so ads never sit under the
 * system navigation bar or bottom tabs.
 */

import { useEffect, useState } from 'react'
import {
	Dimensions,
	StyleSheet,
	View,
	type StyleProp,
	type ViewStyle,
} from 'react-native'
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
	const { ready, sdkAvailable } = useAds()
	const [adSize, setAdSize] = useState<unknown>(null)
	const [failed, setFailed] = useState(false)
	const [loaded, setLoaded] = useState(false)

	useEffect(() => {
		let cancelled = false
		if (!ready || !sdkAvailable || failed) {
			return
		}
		const sdk = loadYandexAds()
		if (!sdk) {
			return
		}
		const width = Math.floor(Dimensions.get('window').width)
		void (async () => {
			try {
				const size = await sdk.BannerAdSize.stickySize(width)
				if (!cancelled) {
					setAdSize(size)
				}
			} catch {
				if (!cancelled) {
					setFailed(true)
				}
			}
		})()
		return () => {
			cancelled = true
		}
	}, [failed, ready, sdkAvailable])

	// Ads must never block layout — render nothing until a size is ready.
	if (!ready || !sdkAvailable || failed || !adSize) {
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
			<BannerView
				size={adSize}
				adUnitId={resolveBannerUnitId(placement)}
				onAdLoaded={() => {
					setLoaded(true)
				}}
				onAdFailedToLoad={() => {
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
		minHeight: 0,
	},
	banner: {
		alignSelf: 'center',
	},
})
