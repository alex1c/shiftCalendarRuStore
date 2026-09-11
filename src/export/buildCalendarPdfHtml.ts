/**
 * HTML template for a month calendar PDF.
 * Light document theme — independent of app dark mode.
 */

import {
	PDF_OVERRIDE_LEGEND,
	PDF_OVERRIDE_MARKER,
	escapeHtml,
	type CalendarExportCell,
	type CalendarExportModel,
} from '@/src/domain'

function kindClass (kind: CalendarExportCell['kind']): string {
	if (kind === 'day') {
		return 'kind-day'
	}
	if (kind === 'night') {
		return 'kind-night'
	}
	if (kind === 'off') {
		return 'kind-off'
	}
	if (kind === 'mixed') {
		return 'kind-mixed'
	}
	return 'kind-other'
}

function renderCell (cell: CalendarExportCell, combined: boolean): string {
	if (!cell.inCurrentMonth) {
		return '<td class="cell outside"><div class="day-num"></div></td>'
	}
	const marker = cell.isOverridden
		? `<span class="marker">${PDF_OVERRIDE_MARKER}</span>`
		: ''
	const shiftHtml = combined && cell.secondaryShortName != null
		? `<div class="shift combined">` +
			`<div>${escapeHtml(cell.primaryShortName)}</div>` +
			`<div>${escapeHtml(cell.secondaryShortName)}</div>` +
			`</div>`
		: `<div class="shift">${escapeHtml(cell.primaryShortName)}${marker}</div>`
	const combinedMarker =
		combined && cell.isOverridden
			? `<span class="marker">${PDF_OVERRIDE_MARKER}</span>`
			: ''
	return (
		`<td class="cell ${kindClass(cell.kind)}">` +
		`<div class="day-num">${cell.day}${combined ? combinedMarker : ''}</div>` +
		shiftHtml +
		`</td>`
	)
}

/**
 * Build a self-contained HTML document for expo-print.
 * Uses system-safe font stacks — no remote web fonts.
 */
export function buildCalendarPdfHtml (model: CalendarExportModel): string {
	const combined = model.mode === 'combined'
	const profileLine = combined && model.secondaryName
		? `${escapeHtml(model.primaryName)} + ${escapeHtml(model.secondaryName)}`
		: escapeHtml(model.primaryName)

	const weekdayRow = model.weekdayLabels
		.map((label) => `<th>${escapeHtml(label)}</th>`)
		.join('')

	const weeks: string[] = []
	for (let index = 0; index < model.cells.length; index += 7) {
		const row = model.cells
			.slice(index, index + 7)
			.map((cell) => renderCell(cell, combined))
			.join('')
		weeks.push(`<tr>${row}</tr>`)
	}

	const legendItems = model.legend
		.map(
			(item) =>
				`<span class="legend-item">` +
				`<strong>${escapeHtml(item.shortName)}</strong>` +
				` — ${escapeHtml(item.label)}` +
				`</span>`,
		)
		.join('')

	const summaryItems = model.summaryLines
		.map(
			(line) =>
				`<span class="summary-item">` +
				`<strong>${escapeHtml(line.label)}:</strong> ` +
				`${escapeHtml(line.value)}` +
				`</span>`,
		)
		.join('')

	const commonBlock =
		combined && model.commonOffCount > 0
			? `<div class="common">` +
				`<strong>Общие выходные: ${model.commonOffCount}</strong>` +
				(model.commonOffList
					? `<div>${escapeHtml(model.commonOffList)}</div>`
					: '') +
				`</div>`
			: combined
				? `<div class="common"><strong>Общие выходные: 0</strong></div>`
				: ''

	const combinedHint = combined
		? `<div class="hint">` +
			`В каждой ячейке: первая строка — ${escapeHtml(model.primaryName)}, ` +
			`вторая — ${escapeHtml(model.secondaryName ?? '')}.` +
			`</div>`
		: ''

	return `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(model.appTitle)} — ${escapeHtml(model.monthLabel)}</title>
<style>
  @page { size: A4 landscape; margin: 10mm; }
  * { box-sizing: border-box; }
  html, body {
    margin: 0;
    padding: 0;
    color: #1c1916;
    background: #ffffff;
    font-family: 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    font-size: 11px;
  }
  .page { padding: 4px 6px; }
  .header { margin-bottom: 8px; }
  .app {
    font-size: 12px;
    font-weight: 600;
    color: #5c564e;
    margin: 0 0 2px;
  }
  .title {
    font-size: 20px;
    font-weight: 700;
    margin: 0;
  }
  .subtitle {
    font-size: 13px;
    color: #5c564e;
    margin: 2px 0 0;
  }
  .hint {
    margin-top: 4px;
    color: #5c564e;
    font-size: 10px;
  }
  table.calendar {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
    margin-top: 8px;
  }
  th {
    padding: 4px;
    font-size: 10px;
    font-weight: 700;
    text-align: center;
    border: 1px solid #cfc8bc;
    background: #f4f1ea;
  }
  td.cell {
    height: 52px;
    vertical-align: top;
    border: 1px solid #d9d2c6;
    padding: 3px 4px;
  }
  td.outside {
    background: #faf8f4;
  }
  .day-num {
    font-size: 10px;
    font-weight: 700;
    color: #3a3530;
  }
  .shift {
    margin-top: 2px;
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.02em;
  }
  .shift.combined {
    font-size: 11px;
    line-height: 1.25;
  }
  .marker {
    color: #8a5a2b;
    font-weight: 700;
    margin-left: 1px;
  }
  .kind-day { background: #f3f7fb; }
  .kind-night { background: #f2eef8; }
  .kind-off { background: #f7f7f5; }
  .kind-other { background: #f8f4ee; }
  .kind-mixed { background: #f5f3ef; }
  .footer {
    margin-top: 10px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .legend, .summary, .common {
    border-top: 1px solid #e4ddd2;
    padding-top: 6px;
  }
  .legend-item, .summary-item {
    display: inline-block;
    margin-right: 12px;
    margin-bottom: 2px;
  }
  .legend-note {
    display: block;
    margin-top: 2px;
    color: #5c564e;
  }
</style>
</head>
<body>
  <div class="page">
    <div class="header">
      <p class="app">${escapeHtml(model.appTitle)}</p>
      <h1 class="title">${escapeHtml(model.monthLabel)}</h1>
      <p class="subtitle">${profileLine}</p>
      ${combinedHint}
    </div>
    <table class="calendar">
      <thead><tr>${weekdayRow}</tr></thead>
      <tbody>${weeks.join('')}</tbody>
    </table>
    <div class="footer">
      <div class="legend">
        ${legendItems}
        <span class="legend-note">${escapeHtml(PDF_OVERRIDE_LEGEND)}</span>
      </div>
      <div class="summary">${summaryItems}</div>
      ${commonBlock}
    </div>
  </div>
</body>
</html>`
}
