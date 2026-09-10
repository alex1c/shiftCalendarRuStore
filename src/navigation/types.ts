import type { NavigatorScreenParams } from '@react-navigation/native'

export type CustomShiftEditorParams = {
	intent: 'create-and-add' | 'create-and-replace' | 'edit'
	shiftTypeId?: string
	cycleIndex?: number
}

export type OnboardingStackParamList = {
	PresetSelect: undefined
	CustomBuilder: undefined
	CustomShiftEditor: CustomShiftEditorParams
	CycleItem: { index: number }
	StartDate: { presetId?: string }
	Confirm: { presetId?: string; startDate: string }
}

export type MoreStackParamList = {
	MoreHome: undefined
	MySchedule: undefined
	Learning: undefined
	About: undefined
}

export type CalendarStackParamList = {
	CalendarHome: undefined
	EditDay: { date: string }
}

export type MainTabParamList = {
	Calendar: NavigatorScreenParams<CalendarStackParamList> | undefined
	Today: undefined
	Stats: undefined
	More: NavigatorScreenParams<MoreStackParamList> | undefined
}

export type RootStackParamList = {
	Onboarding: undefined
	Main: undefined
}
