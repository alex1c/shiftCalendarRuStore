/**
 * App bootstrap — load the persisted schedule and day overrides once.
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

import { emptyOverrideMap, removeOverrideAtDate, upsertOverride } from '@/src/domain'
import {
	clearWorkSchedule,
	getDayOverrides,
	getWorkSchedule,
	saveDayOverrides,
	saveWorkSchedule,
} from '@/src/storage'
import { colors } from '@/src/theme'
import type { DayOverride, DayOverrideMap, WorkSchedule } from '@/src/types'

type AppBootstrapValue = {
	schedule: WorkSchedule | null
	overrides: DayOverrideMap
	ready: boolean
	refreshSchedule: () => Promise<void>
	persistSchedule: (schedule: WorkSchedule) => Promise<void>
	persistDayOverride: (override: DayOverride) => Promise<void>
	clearDayOverride: (date: string) => Promise<void>
	resetSchedule: () => Promise<void>
}

const AppBootstrapContext = createContext<AppBootstrapValue>({
	schedule: null,
	overrides: emptyOverrideMap(),
	ready: false,
	refreshSchedule: async () => undefined,
	persistSchedule: async () => undefined,
	persistDayOverride: async () => undefined,
	clearDayOverride: async () => undefined,
	resetSchedule: async () => undefined,
})

type AppBootstrapProviderProps = {
	children: ReactNode
}

export function AppBootstrapProvider ({
	children,
}: AppBootstrapProviderProps) {
	const [schedule, setSchedule] = useState<WorkSchedule | null>(null)
	const [overrides, setOverrides] = useState<DayOverrideMap>(emptyOverrideMap)
	const [ready, setReady] = useState(false)

	const refreshSchedule = useCallback(async () => {
		const nextSchedule = await getWorkSchedule()
		const nextOverrides = await getDayOverrides()
		setSchedule(nextSchedule)
		setOverrides(nextOverrides)
	}, [])

	const persistSchedule = useCallback(async (next: WorkSchedule) => {
		await saveWorkSchedule(next)
		setSchedule(next)
	}, [])

	const persistDayOverride = useCallback(async (override: DayOverride) => {
		const next = upsertOverride(overrides, override)
		await saveDayOverrides(next)
		setOverrides(next)
	}, [overrides])

	const clearDayOverride = useCallback(async (date: string) => {
		const next = removeOverrideAtDate(overrides, date)
		await saveDayOverrides(next)
		setOverrides(next)
	}, [overrides])

	const resetSchedule = useCallback(async () => {
		await clearWorkSchedule()
		setSchedule(null)
		setOverrides(emptyOverrideMap())
	}, [])

	useEffect(() => {
		let cancelled = false
		void (async () => {
			try {
				const nextSchedule = await getWorkSchedule()
				const nextOverrides = await getDayOverrides()
				if (!cancelled) {
					setSchedule(nextSchedule)
					setOverrides(nextOverrides)
				}
			} catch {
				if (!cancelled) {
					setSchedule(null)
					setOverrides(emptyOverrideMap())
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
			overrides,
			ready,
			refreshSchedule,
			persistSchedule,
			persistDayOverride,
			clearDayOverride,
			resetSchedule,
		}),
		[
			schedule,
			overrides,
			ready,
			refreshSchedule,
			persistSchedule,
			persistDayOverride,
			clearDayOverride,
			resetSchedule,
		],
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
