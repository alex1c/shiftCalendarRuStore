/**
 * Month grid for the calendar UI.
 * Cells carry civil dates only — shift lookup stays in the cycle engine.
 */

import {
	addCalendarDays,
	daysInMonth,
	formatCalendarDate,
	mondayFirstWeekday,
} from './dates'

export type MonthGridCell = {
	date: string
	day: number
	inCurrentMonth: boolean
}

export const MONTH_GRID_CELL_COUNT = 42

/**
 * Six-week Monday-first grid covering `year`/`month` (month is 1–12).
 * Leading/trailing cells belong to adjacent months and stay valid dates.
 */
export function buildMonthGrid (
	year: number,
	month: number,
): MonthGridCell[] {
	const firstIso = formatCalendarDate(year, month, 1)
	const leading = mondayFirstWeekday(firstIso)
	const gridStart = addCalendarDays(firstIso, -leading)
	const currentDays = daysInMonth(year, month)
	const cells: MonthGridCell[] = []

	for (let index = 0; index < MONTH_GRID_CELL_COUNT; index += 1) {
		const date = addCalendarDays(gridStart, index)
		const day = Number(date.slice(8, 10))
		const inCurrentMonth = index >= leading && index < leading + currentDays
		cells.push({ date, day, inCurrentMonth })
	}

	return cells
}
