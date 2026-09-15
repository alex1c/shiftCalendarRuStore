/**
 * Tutorial catalogue structure and copy contracts for release polish.
 */

import {
	REQUIRED_TUTORIAL_TITLES,
	TUTORIAL_SECTIONS,
	getTutorialSectionById,
} from '@/src/learning/tutorialSections'

describe('tutorial sections', () => {
	it('contains every required section title in order', () => {
		expect(TUTORIAL_SECTIONS.map((section) => section.title)).toEqual([
			...REQUIRED_TUTORIAL_TITLES,
		])
	})

	it('includes family schedules, combined calendar, and share', () => {
		expect(getTutorialSectionById('family_schedules')?.title).toBe(
			'Графики семьи',
		)
		expect(getTutorialSectionById('combined_calendar')?.title).toBe(
			'Совместный календарь',
		)
		expect(getTutorialSectionById('share_schedule')?.title).toBe(
			'Поделиться графиком',
		)
	})

	it('documents family schedule route through More → Мои графики', () => {
		const section = getTutorialSectionById('family_schedules')
		expect(section?.routes?.join(' → ')).toContain('Мои графики')
		expect(section?.routes?.join(' → ')).toContain('Добавить график')
		expect(section?.paragraphs.join(' ')).toMatch(/устройств/i)
	})

	it('requires a second profile before combined calendar', () => {
		const section = getTutorialSectionById('combined_calendar')
		expect(section?.paragraphs.join(' ')).toMatch(/второй график/i)
		expect(section?.routes?.some((route) =>
			route.includes('Совместный'),
		)).toBe(true)
	})

	it('explains share exports the selected month', () => {
		const section = getTutorialSectionById('share_schedule')
		const text = section?.paragraphs.join(' ') ?? ''
		expect(text).toMatch(/выбранный месяц/i)
		expect(text).toMatch(/PDF/i)
		expect(text).not.toMatch(/image export|картинк/i)
	})

	it('keeps salary disclaimer and avoids employer payslip claims', () => {
		const section = getTutorialSectionById('salary')
		const text = section?.paragraphs.join(' ') ?? ''
		expect(text).toMatch(/ориентировочный/i)
		expect(text).toMatch(/не является расчётным листком/i)
	})

	it('does not embed user-specific or sensitive fields', () => {
		const blob = JSON.stringify(TUTORIAL_SECTIONS)
		expect(blob).not.toMatch(/profileId|override|effective day|storage/i)
		expect(blob).not.toMatch(/combined view/i)
	})
})
