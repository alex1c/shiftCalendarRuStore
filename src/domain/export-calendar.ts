/**
 * Calendar month export — pure domain model for PDF generation.
 * No native print/share APIs here.
 */

import type { DayOverrideMap, ShiftType, WorkSchedule } from '@/src/types'
import { buildMonthGrid, type MonthGridCell } from './calendar-grid'
import { formatCalendarDate, daysInMonth } from './dates'
import { formatDurationMinutes } from './duration'
import {
	WEEKDAY_LABELS_MONDAY_FIRST,
	formatDayListInMonth,
	formatMonthYear,
	ruPlural,
} from './format'
import {
	OVERRIDE_TYPE_LABELS,
	getEffectiveDay,
	type EffectiveDay,
} from './overrides'
import {
	commonDaysOffInMonth,
	type ScheduleProfile,
} from './profiles'
import {
	computePeriodStats,
	type PeriodStats,
} from './stats'

export const PDF_APP_TITLE = 'Мой график смен'
export const PDF_OVERRIDE_MARKER = '*'
export const PDF_OVERRIDE_LEGEND = '* — изменено вручную'

export type CalendarExportMode = 'single' | 'combined'

export type CalendarExportLegendItem = {
	shortName: string
	label: string
}

export type CalendarExportSummaryLine = {
	label: string
	value: string
}

export type CalendarExportCell = {
	date: string
	day: number
	inCurrentMonth: boolean
	/** Single-profile short name, or left profile when combined. */
	primaryShortName: string
	/** Right profile short name when combined; null otherwise. */
	secondaryShortName: string | null
	isOverridden: boolean
	/** Soft tint hint — never the only meaning carrier. */
	kind: ShiftType['kind'] | 'mixed'
}

export type CalendarExportModel = {
	mode: CalendarExportMode
	appTitle: string
	monthLabel: string
	year: number
	month: number
	primaryName: string
	secondaryName: string | null
	weekdayLabels: readonly string[]
	cells: CalendarExportCell[]
	legend: CalendarExportLegendItem[]
	summaryLines: CalendarExportSummaryLine[]
	commonOffCount: number
	commonOffList: string
	fileName: string
}

const CYRILLIC_TO_LATIN: Record<string, string> = {
	а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh',
	з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o',
	п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts',
	ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu',
	я: 'ya',
}

/** Escape text for safe inclusion in HTML attribute/text nodes. */
export function escapeHtml (value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;')
}

/** ASCII slug for filenames — Cyrillic transliterated, other non-ASCII dropped. */
export function toAsciiFileSlug (raw: string): string {
	const lower = raw.trim().toLowerCase()
	let out = ''
	for (const char of lower) {
		if (CYRILLIC_TO_LATIN[char] !== undefined) {
			out += CYRILLIC_TO_LATIN[char]
			continue
		}
		if (/[a-z0-9]/.test(char)) {
			out += char
			continue
		}
		if (/[\s_-]/.test(char)) {
			out += '_'
		}
	}
	return out.replace(/_+/g, '_').replace(/^_|_$/g, '').slice(0, 32)
}

function pad2 (value: number): string {
	return String(value).padStart(2, '0')
}

/**
 * Safe ASCII PDF filename.
 * Single: `Moi_grafik_smen_2026-09.pdf`
 * Named secondary active: `Moi_grafik_smen_Marina_2026-09.pdf`
 * Combined: `Moi_grafik_smen_combined_Ya_Marina_2026-09.pdf`
 */
export function buildCalendarPdfFileName (input: {
	year: number
	month: number
	mode: CalendarExportMode
	primaryName: string
	secondaryName?: string | null
	isPrimaryProfile?: boolean
}): string {
	const ym = `${input.year}-${pad2(input.month)}`
	if (input.mode === 'combined') {
		const left = toAsciiFileSlug(input.primaryName) || 'A'
		const right = toAsciiFileSlug(input.secondaryName ?? '') || 'B'
		return `Moi_grafik_smen_combined_${left}_${right}_${ym}.pdf`
	}
	if (input.isPrimaryProfile === false) {
		const slug = toAsciiFileSlug(input.primaryName)
		if (slug) {
			return `Moi_grafik_smen_${slug}_${ym}.pdf`
		}
	}
	return `Moi_grafik_smen_${ym}.pdf`
}

function addLegend (
	map: Map<string, string>,
	shortName: string,
	label: string,
): void {
	const key = shortName.trim()
	if (!key || map.has(key)) {
		return
	}
	map.set(key, label)
}

function legendFromDay (map: Map<string, string>, day: EffectiveDay): void {
	const shift = day.shift
	addLegend(map, shift.shortName, shift.name)
	if (day.override?.type === 'extraShift') {
		addLegend(map, shift.shortName, OVERRIDE_TYPE_LABELS.extraShift)
	}
}

function buildSummaryLines (stats: PeriodStats): CalendarExportSummaryLine[] {
	const lines: CalendarExportSummaryLine[] = []
	lines.push({
		label: 'Смен',
		value: String(stats.workShifts),
	})
	lines.push({
		label: 'Рабочих часов',
		value: formatDurationMinutes(stats.workMinutes),
	})
	lines.push({
		label: 'Выходных',
		value: String(stats.offDays),
	})
	if (stats.vacationDays > 0) {
		lines.push({
			label: 'Отпуск',
			value: `${stats.vacationDays} ${ruPlural(stats.vacationDays, 'день', 'дня', 'дней')}`,
		})
	}
	if (stats.sickDays > 0) {
		lines.push({
			label: 'Больничный',
			value: `${stats.sickDays} ${ruPlural(stats.sickDays, 'день', 'дня', 'дней')}`,
		})
	}
	if (stats.dayOffDays > 0) {
		lines.push({
			label: 'Отгул',
			value: `${stats.dayOffDays} ${ruPlural(stats.dayOffDays, 'день', 'дня', 'дней')}`,
		})
	}
	if (stats.extraShifts > 0) {
		lines.push({
			label: 'Доп. смены',
			value: String(stats.extraShifts),
		})
	}
	if (stats.overtimeMinutes > 0) {
		lines.push({
			label: 'Переработка',
			value: formatDurationMinutes(stats.overtimeMinutes),
		})
	}
	return lines
}

function cellFromDay (
	gridCell: MonthGridCell,
	day: EffectiveDay,
	secondary: EffectiveDay | null,
): CalendarExportCell {
	if (secondary) {
		return {
			date: gridCell.date,
			day: gridCell.day,
			inCurrentMonth: gridCell.inCurrentMonth,
			primaryShortName: day.shift.shortName,
			secondaryShortName: secondary.shift.shortName,
			isOverridden: day.isOverridden || secondary.isOverridden,
			kind:
				day.shift.kind === secondary.shift.kind
					? day.shift.kind
					: 'mixed',
		}
	}
	return {
		date: gridCell.date,
		day: gridCell.day,
		inCurrentMonth: gridCell.inCurrentMonth,
		primaryShortName: day.shift.shortName,
		secondaryShortName: null,
		isOverridden: day.isOverridden,
		kind: day.shift.kind,
	}
}

export type BuildMonthExportModelInput = {
	year: number
	month: number
	primary: ScheduleProfile
	secondary?: ScheduleProfile | null
	combined?: boolean
}

/**
 * Build the month export document model from effective days.
 * Combined mode requires a valid secondary profile; otherwise falls back
 * to a single-profile export of `primary`.
 */
export function buildMonthExportModel (
	input: BuildMonthExportModelInput,
): CalendarExportModel {
	const { year, month, primary } = input
	const secondary =
		input.combined && input.secondary ? input.secondary : null
	const mode: CalendarExportMode = secondary ? 'combined' : 'single'
	const cellsGrid = buildMonthGrid(year, month)
	const legendMap = new Map<string, string>()
	const cells: CalendarExportCell[] = []

	for (const gridCell of cellsGrid) {
		const left = getEffectiveDay(
			primary.schedule,
			gridCell.date,
			primary.overrides,
		)
		legendFromDay(legendMap, left)
		let right: EffectiveDay | null = null
		if (secondary) {
			right = getEffectiveDay(
				secondary.schedule,
				gridCell.date,
				secondary.overrides,
			)
			legendFromDay(legendMap, right)
		}
		cells.push(cellFromDay(gridCell, left, right))
	}

	const startDate = formatCalendarDate(year, month, 1)
	const endDate = formatCalendarDate(year, month, daysInMonth(year, month))
	const stats = computePeriodStats(
		primary.schedule,
		primary.overrides as DayOverrideMap,
		startDate,
		endDate,
	)

	const commonOff = secondary
		? commonDaysOffInMonth(primary, secondary, year, month)
		: []

	const legend: CalendarExportLegendItem[] = [...legendMap.entries()].map(
		([shortName, label]) => ({ shortName, label }),
	)
	legend.sort((a, b) => a.shortName.localeCompare(b.shortName, 'ru'))

	return {
		mode,
		appTitle: PDF_APP_TITLE,
		monthLabel: formatMonthYear(year, month),
		year,
		month,
		primaryName: primary.name,
		secondaryName: secondary?.name ?? null,
		weekdayLabels: WEEKDAY_LABELS_MONDAY_FIRST,
		cells,
		legend,
		summaryLines: buildSummaryLines(stats),
		commonOffCount: commonOff.length,
		commonOffList: formatDayListInMonth(commonOff),
		fileName: buildCalendarPdfFileName({
			year,
			month,
			mode,
			primaryName: primary.name,
			secondaryName: secondary?.name ?? null,
			isPrimaryProfile: primary.isPrimary,
		}),
	}
}

/** Convenience for tests — effective short names in-month only. */
export function collectInMonthShortNames (
	schedule: WorkSchedule,
	year: number,
	month: number,
	overrides: DayOverrideMap = {},
): string[] {
	const names: string[] = []
	const days = daysInMonth(year, month)
	for (let day = 1; day <= days; day += 1) {
		const date = formatCalendarDate(year, month, day)
		const effective = getEffectiveDay(schedule, date, overrides)
		names.push(effective.shift.shortName)
	}
	return names
}
