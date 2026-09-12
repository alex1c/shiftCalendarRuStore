/**
 * Ads React context — session policy, SDK init, protected flows, interstitial.
 */

import AsyncStorage from '@react-native-async-storage/async-storage'
import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
	type ReactNode,
} from 'react'

import { isAdsTestMode } from './adsConfig'
import {
	createAdsSessionState,
	enterProtectedFlow,
	exitProtectedFlow,
	recordAdsInteraction,
	setOnboardingActive,
	type AdsSessionState,
	type InterstitialTrigger,
} from './adsSessionPolicy'
import { tryShowInterstitial } from './interstitialController'
import { loadYandexAds } from './yandexAdsNative'

const FIRST_LAUNCH_KEY = 'ads.has_reached_main'

type AdsContextValue = {
	ready: boolean
	sdkAvailable: boolean
	session: AdsSessionState
	recordInteraction: (amount?: number) => void
	enterProtected: () => void
	exitProtected: () => void
	setOnboarding: (active: boolean) => void
	requestInterstitial: (trigger: InterstitialTrigger) => Promise<boolean>
	/** Persist that the user has reached main UI at least once. */
	markMainReached: () => Promise<void>
}

const AdsContext = createContext<AdsContextValue>({
	ready: false,
	sdkAvailable: false,
	session: createAdsSessionState(),
	recordInteraction: () => undefined,
	enterProtected: () => undefined,
	exitProtected: () => undefined,
	setOnboarding: () => undefined,
	requestInterstitial: async () => false,
	markMainReached: async () => undefined,
})

type AdsProviderProps = {
	children: ReactNode
}

export function AdsProvider ({ children }: AdsProviderProps) {
	const [session, setSession] = useState<AdsSessionState>(() =>
		createAdsSessionState({ isFirstLaunchSession: true }),
	)
	const [ready, setReady] = useState(false)
	const [sdkAvailable, setSdkAvailable] = useState(false)
	const sessionRef = useRef(session)
	const showingRef = useRef(false)

	useEffect(() => {
		sessionRef.current = session
	}, [session])

	useEffect(() => {
		let cancelled = false
		void (async () => {
			try {
				const seen = await AsyncStorage.getItem(FIRST_LAUNCH_KEY)
				if (!cancelled) {
					setSession((current) => ({
						...current,
						isFirstLaunchSession: seen !== '1',
					}))
				}
			} catch {
				// Default to cautious first-launch blocking.
			}

			const sdk = loadYandexAds()
			if (!sdk) {
				if (!cancelled) {
					setSdkAvailable(false)
					setReady(true)
				}
				return
			}

			try {
				if (isAdsTestMode()) {
					sdk.MobileAds.enableLogging(true)
					sdk.MobileAds.enableDebugErrorIndicator(true)
				}
				await sdk.MobileAds.initialize()
				if (!cancelled) {
					setSdkAvailable(true)
				}
			} catch {
				if (!cancelled) {
					setSdkAvailable(false)
				}
			} finally {
				if (!cancelled) {
					setReady(true)
				}
			}
		})()
		return () => {
			cancelled = true
		}
	}, [])

	const recordInteraction = useCallback((amount: number = 1) => {
		setSession((current) => recordAdsInteraction(current, amount))
	}, [])

	const enterProtected = useCallback(() => {
		setSession((current) => enterProtectedFlow(current))
	}, [])

	const exitProtected = useCallback(() => {
		setSession((current) => exitProtectedFlow(current))
	}, [])

	const setOnboarding = useCallback((active: boolean) => {
		setSession((current) => setOnboardingActive(current, active))
	}, [])

	const markMainReached = useCallback(async () => {
		try {
			await AsyncStorage.setItem(FIRST_LAUNCH_KEY, '1')
		} catch {
			// Ignore persistence failures.
		}
	}, [])

	const requestInterstitial = useCallback(async (
		trigger: InterstitialTrigger,
	) => {
		if (showingRef.current) {
			return false
		}
		showingRef.current = true
		try {
			const { result, state: next } = await tryShowInterstitial(
				sessionRef.current,
				trigger,
			)
			setSession(next)
			sessionRef.current = next
			return result.shown
		} finally {
			showingRef.current = false
		}
	}, [])

	const value = useMemo<AdsContextValue>(
		() => ({
			ready,
			sdkAvailable,
			session,
			recordInteraction,
			enterProtected,
			exitProtected,
			setOnboarding,
			requestInterstitial,
			markMainReached,
		}),
		[
			ready,
			sdkAvailable,
			session,
			recordInteraction,
			enterProtected,
			exitProtected,
			setOnboarding,
			requestInterstitial,
			markMainReached,
		],
	)

	return (
		<AdsContext.Provider value={value}>{children}</AdsContext.Provider>
	)
}

export function useAds (): AdsContextValue {
	return useContext(AdsContext)
}
