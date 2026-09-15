import {
	getConfirmCompletionNavigation,
} from '@/src/screens/onboarding/confirmNavigation'

describe('schedule creation navigation', () => {
	it('lets root bootstrap state enter Main after the first profile', () => {
		expect(getConfirmCompletionNavigation(0)).toBe('root-state')
	})

	it('returns from AddProfile after a secondary profile', () => {
		expect(getConfirmCompletionNavigation(1)).toBe('parent-back')
		expect(getConfirmCompletionNavigation(2)).toBe('parent-back')
	})
})
