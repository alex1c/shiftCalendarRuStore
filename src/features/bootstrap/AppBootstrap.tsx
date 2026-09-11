/**
 * App bootstrap — load profiles, the active schedule and salary settings.
 * Native storage reads stay sequential.
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
	DEFAULT_PRIMARY_PROFILE_NAME,
	DEFAULT_SECONDARY_PROFILE_NAME,
	MAX_PROFILES,
	buildScheduleProfile,
	emptyOverrideMap,
	findPrimaryProfile,
	nextProfileAccent,
	removeOverrideAtDate,
	renameProfile,
	replaceProfile,
	resolveActiveProfile,
	updateProfileOverrides,
	updateProfileSchedule,
	upsertOverride,
	type SalarySettings,
	type ScheduleProfile,
} from '@/src/domain'
import {
	clearSalarySettings,
	clearWorkSchedule,
	getActiveProfileId,
	getProfiles,
	getSalarySettings,
	saveActiveProfileId,
	saveProfiles,
	saveSalarySettings,
} from '@/src/storage'
import { colors } from '@/src/theme'
import type { DayOverride, DayOverrideMap, WorkSchedule } from '@/src/types'

type AppBootstrapValue = {
	profiles: ScheduleProfile[]
	activeProfile: ScheduleProfile | null
	primaryProfile: ScheduleProfile | null
	schedule: WorkSchedule | null
	overrides: DayOverrideMap
	salarySettings: SalarySettings | null
	ready: boolean
	canAddProfile: boolean
	refreshSchedule: () => Promise<void>
	setActiveProfileId: (id: string) => Promise<void>
	persistSchedule: (schedule: WorkSchedule) => Promise<void>
	persistDayOverride: (override: DayOverride) => Promise<void>
	clearDayOverride: (date: string) => Promise<void>
	addProfile: (name: string, schedule: WorkSchedule) => Promise<void>
	renameProfileById: (id: string, name: string) => Promise<void>
	deleteProfileById: (id: string) => Promise<void>
	persistSalarySettings: (settings: SalarySettings) => Promise<void>
	resetSalarySettings: () => Promise<void>
	resetSchedule: () => Promise<void>
}

const AppBootstrapContext = createContext<AppBootstrapValue>({
	profiles: [],
	activeProfile: null,
	primaryProfile: null,
	schedule: null,
	overrides: emptyOverrideMap(),
	salarySettings: null,
	ready: false,
	canAddProfile: false,
	refreshSchedule: async () => undefined,
	setActiveProfileId: async () => undefined,
	persistSchedule: async () => undefined,
	persistDayOverride: async () => undefined,
	clearDayOverride: async () => undefined,
	addProfile: async () => undefined,
	renameProfileById: async () => undefined,
	deleteProfileById: async () => undefined,
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
	const [profiles, setProfiles] = useState<ScheduleProfile[]>([])
	const [activeProfileId, setActiveId] = useState<string | null>(null)
	const [salarySettings, setSalarySettings] =
		useState<SalarySettings | null>(null)
	const [ready, setReady] = useState(false)

	const activeProfile = useMemo(
		() => resolveActiveProfile(profiles, activeProfileId),
		[profiles, activeProfileId],
	)
	const primaryProfile = useMemo(
		() => findPrimaryProfile(profiles),
		[profiles],
	)
	const schedule = activeProfile?.schedule ?? null
	const overrides = activeProfile?.overrides ?? emptyOverrideMap()
	const canAddProfile = profiles.length < MAX_PROFILES

	const refreshSchedule = useCallback(async () => {
		const nextProfiles = await getProfiles()
		const nextActiveId = await getActiveProfileId()
		const nextSalary = await getSalarySettings()
		setProfiles(nextProfiles)
		setActiveId(nextActiveId)
		setSalarySettings(nextSalary)
	}, [])

	const persistProfiles = useCallback(
		async (
			next: ScheduleProfile[],
			nextActiveId: string | null = activeProfileId,
		) => {
			await saveProfiles(next)
			if (nextActiveId) {
				await saveActiveProfileId(nextActiveId)
			}
			setProfiles(next)
			setActiveId(nextActiveId)
		},
		[activeProfileId],
	)

	const setActiveProfileId = useCallback(async (id: string) => {
		await saveActiveProfileId(id)
		setActiveId(id)
	}, [])

	const persistSchedule = useCallback(async (next: WorkSchedule) => {
		if (!activeProfile) {
			const profile = buildScheduleProfile({
				name: DEFAULT_PRIMARY_PROFILE_NAME,
				schedule: next,
				overrides: emptyOverrideMap(),
				accent: 'blue',
				isPrimary: true,
			})
			await persistProfiles([profile], profile.id)
			return
		}
		const updated = updateProfileSchedule(activeProfile, next)
		await persistProfiles(replaceProfile(profiles, updated))
	}, [activeProfile, persistProfiles, profiles])

	const persistDayOverride = useCallback(async (override: DayOverride) => {
		if (!activeProfile) {
			return
		}
		const nextOverrides = upsertOverride(activeProfile.overrides, override)
		const updated = updateProfileOverrides(activeProfile, nextOverrides)
		await persistProfiles(replaceProfile(profiles, updated))
	}, [activeProfile, persistProfiles, profiles])

	const clearDayOverride = useCallback(async (date: string) => {
		if (!activeProfile) {
			return
		}
		const nextOverrides = removeOverrideAtDate(
			activeProfile.overrides,
			date,
		)
		const updated = updateProfileOverrides(activeProfile, nextOverrides)
		await persistProfiles(replaceProfile(profiles, updated))
	}, [activeProfile, persistProfiles, profiles])

	const addProfile = useCallback(async (
		name: string,
		nextSchedule: WorkSchedule,
	) => {
		if (profiles.length >= MAX_PROFILES) {
			return
		}
		const profile = buildScheduleProfile({
			name: name || DEFAULT_SECONDARY_PROFILE_NAME,
			schedule: nextSchedule,
			accent: nextProfileAccent(profiles),
			isPrimary: false,
		})
		await persistProfiles([...profiles, profile], profile.id)
	}, [persistProfiles, profiles])

	const renameProfileById = useCallback(async (id: string, name: string) => {
		const current = profiles.find((item) => item.id === id)
		if (!current) {
			return
		}
		await persistProfiles(
			replaceProfile(profiles, renameProfile(current, name)),
		)
	}, [persistProfiles, profiles])

	const deleteProfileById = useCallback(async (id: string) => {
		const current = profiles.find((item) => item.id === id)
		if (!current || current.isPrimary || profiles.length <= 1) {
			return
		}
		const next = profiles.filter((item) => item.id !== id)
		const nextActive =
			activeProfileId === id
				? (findPrimaryProfile(next)?.id ?? next[0]?.id ?? null)
				: activeProfileId
		await persistProfiles(next, nextActive)
	}, [activeProfileId, persistProfiles, profiles])

	const persistSalarySettings = useCallback(
		async (next: SalarySettings) => {
			const bound: SalarySettings = {
				...next,
				profileId: next.profileId ?? primaryProfile?.id ?? null,
			}
			await saveSalarySettings(bound)
			setSalarySettings(bound)
		},
		[primaryProfile?.id],
	)

	const resetSalarySettings = useCallback(async () => {
		await clearSalarySettings()
		setSalarySettings(null)
	}, [])

	const resetSchedule = useCallback(async () => {
		await clearWorkSchedule()
		setProfiles([])
		setActiveId(null)
	}, [])

	useEffect(() => {
		let cancelled = false
		void (async () => {
			try {
				const nextProfiles = await getProfiles()
				const nextActiveId = await getActiveProfileId()
				const nextSalary = await getSalarySettings()
				if (!cancelled) {
					setProfiles(nextProfiles)
					setActiveId(nextActiveId)
					setSalarySettings(nextSalary)
				}
			} catch {
				if (!cancelled) {
					setProfiles([])
					setActiveId(null)
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
			profiles,
			activeProfile,
			primaryProfile,
			schedule,
			overrides,
			salarySettings,
			ready,
			canAddProfile,
			refreshSchedule,
			setActiveProfileId,
			persistSchedule,
			persistDayOverride,
			clearDayOverride,
			addProfile,
			renameProfileById,
			deleteProfileById,
			persistSalarySettings,
			resetSalarySettings,
			resetSchedule,
		}),
		[
			profiles,
			activeProfile,
			primaryProfile,
			schedule,
			overrides,
			salarySettings,
			ready,
			canAddProfile,
			refreshSchedule,
			setActiveProfileId,
			persistSchedule,
			persistDayOverride,
			clearDayOverride,
			addProfile,
			renameProfileById,
			deleteProfileById,
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
