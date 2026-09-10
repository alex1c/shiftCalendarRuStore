/**
 * App bootstrap — load the persisted schedule, day overrides and salary
 * settings once. Native storage reads stay sequential.
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
	emptyOverrideMap,
	removeOverrideAtDate,
	upsertOverride,
	type SalarySettings,
} from '@/src/domain'
import {
	clearSalarySettings,
	clearWorkSchedule,
	getDayOverrides,
	getSalarySettings,
	getWorkSchedule,
	saveDayOverrides,
	saveSalarySettings,
	saveWorkSchedule,
} from '@/src/storage'
import { colors } from '@/src/theme'
import type { DayOverride, DayOverrideMap, WorkSchedule } from '@/src/types'

type AppBootstrapValue = {
	schedule: WorkSchedule | null
	overrides: DayOverrideMap
	salarySettings: SalarySettings | null
	ready: boolean
	refreshSchedule: () => Promise<void>
	persistSchedule: (schedule: WorkSchedule) => Promise<void>
	persistDayOverride: (override: DayOverride) => Promise<void>
	clearDayOverride: (date: string) => Promise<void>
	persistSalarySettings: (settings: SalarySettings) => Promise<void>
	resetSalarySettings: () => Promise<void>
	resetSchedule: () => Promise<void>
}

const AppBootstrapContext = createContext<AppBootstrapValue>({
	schedule: null,
	overrides: emptyOverrideMap(),
	salarySettings: null,
	ready: false,
	refreshSchedule: async () => undefined,
	persistSchedule: async () => undefined,
	persistDayOverride: async () => undefined,
	clearDayOverride: async () => undefined,
	persistSalarySettings: async () => undefined,
	resetSalarySettings: async () => undefined,
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
	const [salarySettings, setSalarySettings] =
		useState<SalarySettings | null>(null)
	const [ready, setReady] = useState(false)

	const refreshSchedule = useCallback(async () => {
		const nextSchedule = await getWorkSchedule()
		const nextOverrides = await getDayOverrides()
		const nextSalary = await getSalarySettings()
		setSchedule(nextSchedule)
		setOverrides(nextOverrides)
		setSalarySettings(nextSalary)
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

	const persistSalarySettings = useCallback(
		async (next: SalarySettings) => {
			await saveSalarySettings(next)
			setSalarySettings(next)
		},
		[],
	)

	const resetSalarySettings = useCallback(async () => {
		await clearSalarySettings()
		setSalarySettings(null)
	}, [])

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
				const nextSalary = await getSalarySettings()
				if (!cancelled) {
					setSchedule(nextSchedule)
					setOverrides(nextOverrides)
					setSalarySettings(nextSalary)
				}
			} catch {
				if (!cancelled) {
					setSchedule(null)
					setOverrides(emptyOverrideMap())
					setSalarySettings(null)
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
			salarySettings,
			ready,
			refreshSchedule,
			persistSchedule,
			persistDayOverride,
			clearDayOverride,
			persistSalarySettings,
			resetSalarySettings,
			resetSchedule,
		}),
		[
			schedule,
			overrides,
			salarySettings,
			ready,
			refreshSchedule,
			persistSchedule,
			persistDayOverride,
			clearDayOverride,
			persistSalarySettings,
			resetSalarySettings,
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
