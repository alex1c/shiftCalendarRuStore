/**
 * App bootstrap — load the persisted schedule once and expose refresh.
 */

import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
	type ReactNode,
} from 'react'
import { ActivityIndicator, StyleSheet, View } from 'react-native'

import {
	clearWorkSchedule,
	getWorkSchedule,
	saveWorkSchedule,
} from '@/src/storage'
import { colors } from '@/src/theme'
import type { WorkSchedule } from '@/src/types'

type AppBootstrapValue = {
	schedule: WorkSchedule | null
	ready: boolean
	refreshSchedule: () => Promise<void>
	persistSchedule: (schedule: WorkSchedule) => Promise<void>
	resetSchedule: () => Promise<void>
}

const AppBootstrapContext = createContext<AppBootstrapValue>({
	schedule: null,
	ready: false,
	refreshSchedule: async () => undefined,
	persistSchedule: async () => undefined,
	resetSchedule: async () => undefined,
})

type AppBootstrapProviderProps = {
	children: ReactNode
}

export function AppBootstrapProvider ({
	children,
}: AppBootstrapProviderProps) {
	const [schedule, setSchedule] = useState<WorkSchedule | null>(null)
	const [ready, setReady] = useState(false)

	const refreshSchedule = useCallback(async () => {
		const next = await getWorkSchedule()
		setSchedule(next)
	}, [])

	const persistSchedule = useCallback(async (next: WorkSchedule) => {
		await saveWorkSchedule(next)
		setSchedule(next)
	}, [])

	const resetSchedule = useCallback(async () => {
		await clearWorkSchedule()
		setSchedule(null)
	}, [])

	useEffect(() => {
		let cancelled = false
		void (async () => {
			try {
				const next = await getWorkSchedule()
				if (!cancelled) {
					setSchedule(next)
				}
			} catch {
				if (!cancelled) {
					setSchedule(null)
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

	const value = useMemo(
		() => ({
			schedule,
			ready,
			refreshSchedule,
			persistSchedule,
			resetSchedule,
		}),
		[schedule, ready, refreshSchedule, persistSchedule, resetSchedule],
	)

	if (!ready) {
		return (
			<View style={styles.boot}>
				<ActivityIndicator
					size="large"
					color={colors.light.primary}
				/>
			</View>
		)
	}

	return (
		<AppBootstrapContext.Provider value={value}>
			{children}
		</AppBootstrapContext.Provider>
	)
}

export function useAppBootstrap (): AppBootstrapValue {
	return useContext(AppBootstrapContext)
}

const styles = StyleSheet.create({
	boot: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
		backgroundColor: colors.light.background,
	},
})
