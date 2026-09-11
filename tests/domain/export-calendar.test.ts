/**
 * Calendar PDF export model and HTML safety tests.
 */

import {
	buildCalendarPdfFileName,
	buildDayOverride,
	buildMonthExportModel,
	buildScheduleProfile,
	createWorkScheduleFromPreset,
	escapeHtml,
	requireSchedulePreset,
	toAsciiFileSlug,
	upsertOverride,
	validateDayOverride,
	type DayOverride,
	type DayOverrideInput,
} from '@/src/domain'
import { buildCalendarPdfHtml } from '@/src/export'

const STAMP = new Date('2026-09-01T12:00:00.000Z')

function twoTwo (startDate = '2026-09-01') {
	return createWorkScheduleFromPreset({
		preset: requireSchedulePreset('2-2'),
		startDate,
		now: STAMP,
	})
}

function overrideFrom (input: DayOverrideInput): DayOverride {
	const checked = validateDayOverride(input)
	if (!checked.ok) {
		throw new Error(checked.message)
	}
	return buildDayOverride(checked.value, null, STAMP)
}

describe('escapeHtml / filename', () => {
	it('escapes HTML special characters', () => {
		expect(escapeHtml(`A & B <C> "D" 'E'`)).toBe(
			'A &amp; B &lt;C&gt; &quot;D&quot; &#39;E&#39;',
		)
	})

	it('transliterates Cyrillic profile names for filenames', () => {
		expect(toAsciiFileSlug('Марина')).toBe('marina')
		expect(toAsciiFileSlug('Я')).toBe('ya')
	})

	it('builds ASCII filenames for single, secondary and combined', () => {
		expect(
			buildCalendarPdfFileName({
				year: 2026,
				month: 9,
				mode: 'single',
				primaryName: 'Я',
				isPrimaryProfile: true,
			}),
		).toBe('Moi_grafik_smen_2026-09.pdf')

		expect(
			buildCalendarPdfFileName({
				year: 2026,
				month: 9,
				mode: 'single',
				primaryName: 'Марина',
				isPrimaryProfile: false,
			}),
		).toBe('Moi_grafik_smen_marina_2026-09.pdf')

		expect(
			buildCalendarPdfFileName({
				year: 2026,
				month: 9,
				mode: 'combined',
				primaryName: 'Я',
				secondaryName: 'Марина',
			}),
		).toBe('Moi_grafik_smen_combined_ya_marina_2026-09.pdf')
	})
})

describe('buildMonthExportModel', () => {
	it('exports a known 2/2 September month with Russian labels', () => {
		const me = buildScheduleProfile({
			name: 'Я',
			schedule: twoTwo('2026-09-01'),
			accent: 'blue',
			isPrimary: true,
			now: STAMP,
		})
		const model = buildMonthExportModel({
			year: 2026,
			month: 9,
			primary: me,
		})
		expect(model.monthLabel).toBe('Сентябрь 2026')
		expect(model.appTitle).toBe('Мой график смен')
		expect(model.weekdayLabels[0]).toBe('Пн')
		expect(model.weekdayLabels[6]).toBe('Вс')
		expect(model.mode).toBe('single')
		expect(model.cells).toHaveLength(42)
		expect(model.fileName).toBe('Moi_grafik_smen_2026-09.pdf')
		expect(model.summaryLines.some((line) => line.label === 'Смен')).toBe(
			true,
		)
		expect(model.legend.some((item) => item.shortName === 'Д')).toBe(true)
		expect(model.legend.some((item) => item.label === 'Дневная')).toBe(true)
	})

	it('exports vacation and extra-shift overrides as effective days', () => {
		const schedule = twoTwo('2026-09-01')
		const overrides = upsertOverride(
			upsertOverride(
				{},
				overrideFrom({ date: '2026-09-01', type: 'vacation' }),
			),
			overrideFrom({
				date: '2026-09-03',
				type: 'extraShift',
				shiftTypeId: 'day',
				startTime: '08:00',
				endTime: '20:00',
				breakMinutes: 0,
			}),
		)
		const me = buildScheduleProfile({
			name: 'Я',
			schedule,
			overrides,
			accent: 'blue',
			isPrimary: true,
			now: STAMP,
		})
		const model = buildMonthExportModel({
			year: 2026,
			month: 9,
			primary: me,
		})
		const vacation = model.cells.find((cell) => cell.date === '2026-09-01')
		const extra = model.cells.find((cell) => cell.date === '2026-09-03')
		expect(vacation?.primaryShortName).toBe('ОТП')
		expect(vacation?.isOverridden).toBe(true)
		expect(extra?.primaryShortName).toBe('ДС')
		expect(extra?.isOverridden).toBe(true)
		expect(
			model.summaryLines.some((line) => line.label === 'Отпуск'),
		).toBe(true)
		expect(
			model.summaryLines.some((line) => line.label === 'Доп. смены'),
		).toBe(true)
	})

	it('builds combined cells and common days off', () => {
		const me = buildScheduleProfile({
			name: 'Я',
			schedule: twoTwo('2026-09-01'),
			accent: 'blue',
			isPrimary: true,
			now: STAMP,
		})
		const marina = buildScheduleProfile({
			name: 'Марина',
			schedule: twoTwo('2026-09-01'),
			accent: 'green',
			isPrimary: false,
			now: STAMP,
		})
		const model = buildMonthExportModel({
			year: 2026,
			month: 9,
			primary: me,
			secondary: marina,
			combined: true,
		})
		expect(model.mode).toBe('combined')
		expect(model.secondaryName).toBe('Марина')
		const sample = model.cells.find((cell) => cell.date === '2026-09-01')
		expect(sample?.primaryShortName).toBe('Д')
		expect(sample?.secondaryShortName).toBe('Д')
		const offDay = model.cells.find((cell) => cell.date === '2026-09-03')
		expect(offDay?.primaryShortName).toBe('В')
		expect(offDay?.secondaryShortName).toBe('В')
		expect(model.commonOffCount).toBeGreaterThan(0)
		expect(model.commonOffList).toContain('сентября')
		expect(model.fileName).toContain('combined')
	})

	it('covers leap February 2028 with 29 days', () => {
		const me = buildScheduleProfile({
			name: 'Я',
			schedule: twoTwo('2028-02-01'),
			accent: 'blue',
			isPrimary: true,
			now: STAMP,
		})
		const model = buildMonthExportModel({
			year: 2028,
			month: 2,
			primary: me,
		})
		expect(model.monthLabel).toBe('Февраль 2028')
		expect(model.cells.some((cell) => cell.date === '2028-02-29')).toBe(
			true,
		)
		const feb29 = model.cells.find((cell) => cell.date === '2028-02-29')
		expect(feb29?.inCurrentMonth).toBe(true)
		expect(model.fileName).toBe('Moi_grafik_smen_2028-02.pdf')
	})

	it('keeps custom short names in cells and full names in the legend', () => {
		const base = twoTwo('2026-09-01')
		const customShift = {
			id: 'custom_evening',
			name: 'Вечерняя смена',
			shortName: 'ВЧ',
			kind: 'custom' as const,
			startTime: '14:00',
			endTime: '22:00',
			breakMinutes: 0,
			color: 'accent' as const,
		}
		const schedule = {
			...base,
			shiftTypes: [...base.shiftTypes, customShift],
			cycle: base.cycle.map((id, index) =>
				index === 0 ? customShift.id : id,
			),
		}
		const me = buildScheduleProfile({
			name: 'Я',
			schedule,
			accent: 'blue',
			isPrimary: true,
			now: STAMP,
		})
		const model = buildMonthExportModel({
			year: 2026,
			month: 9,
			primary: me,
		})
		expect(
			model.cells.some(
				(cell) =>
					cell.inCurrentMonth && cell.primaryShortName === 'ВЧ',
			),
		).toBe(true)
		expect(
			model.legend.some(
				(item) =>
					item.shortName === 'ВЧ' && item.label === 'Вечерняя смена',
			),
		).toBe(true)
	})
})

describe('buildCalendarPdfHtml', () => {
	it('escapes dangerous profile names inside HTML', () => {
		const me = buildScheduleProfile({
			name: `Я & <Марина> "Test"`,
			schedule: twoTwo('2026-09-01'),
			accent: 'blue',
			isPrimary: true,
			now: STAMP,
		})
		const model = buildMonthExportModel({
			year: 2026,
			month: 9,
			primary: me,
		})
		const html = buildCalendarPdfHtml(model)
		expect(html).toContain('Я &amp; &lt;Марина&gt; &quot;Test&quot;')
		expect(html).not.toContain('<Марина>')
		expect(html).toContain('Сентябрь 2026')
		expect(html).toContain('Пн')
		expect(html).toContain('@page { size: A4 landscape;')
	})
})
