/**
 * Learning / discovery helpers for the in-app tutorial.
 */

export {
	REQUIRED_TUTORIAL_TITLES,
	TUTORIAL_SECTIONS,
	getTutorialSectionById,
	type TutorialIconName,
	type TutorialSection,
} from './tutorialSections'
export { DiscoveryHintModal } from './DiscoveryHintModal'
export {
	DEFAULT_UI_HINTS,
	UI_HINTS_SCHEMA_VERSION,
	UI_HINTS_STORAGE_KEY,
	dismissCombinedHint,
	dismissShareHint,
	getUiHints,
	markLearningTipShown,
	normalizeUiHints,
	recordCalendarVisitForShareHint,
	saveUiHints,
	shouldShowCombinedHint,
	shouldShowLearningTip,
	type UiHintsState,
} from './uiHints'
