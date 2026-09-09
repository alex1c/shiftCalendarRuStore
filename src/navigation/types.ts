import type { NavigatorScreenParams } from '@react-navigation/native'

export type OnboardingStackParamList = {
	PresetSelect: undefined
	CustomComingSoon: undefined
	StartDate: { presetId: string }
	Confirm: { presetId: string; startDate: string }
}

export type MoreStackParamList = {
	MoreHome: undefined
	MySchedule: undefined
	Learning: undefined
	About: undefined
}

export type MainTabParamList = {
	Calendar: undefined
	Today: undefined
	Stats: undefined
	More: NavigatorScreenParams<MoreStackParamList> | undefined
}

export type RootStackParamList = {
	Onboarding: undefined
	Main: undefined
}
