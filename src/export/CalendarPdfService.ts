/**
 * Native PDF create + share for calendar month exports.
 */

import { File, Paths } from 'expo-file-system'
import * as Print from 'expo-print'
import * as Sharing from 'expo-sharing'

import {
	buildMonthExportModel,
	type BuildMonthExportModelInput,
	type CalendarExportModel,
} from '@/src/domain'
import { buildCalendarPdfHtml } from './buildCalendarPdfHtml'

/** A4 landscape at 72 DPI (points). */
const PDF_WIDTH = 842
const PDF_HEIGHT = 595

export type CreatedCalendarPdf = {
	uri: string
	fileName: string
	model: CalendarExportModel
	html: string
}

/**
 * Generate a month PDF in the cache directory with a stable ASCII filename.
 */
export async function createCalendarPdf (
	input: BuildMonthExportModelInput,
): Promise<CreatedCalendarPdf> {
	const model = buildMonthExportModel(input)
	const html = buildCalendarPdfHtml(model)
	const printed = await Print.printToFileAsync({
		html,
		width: PDF_WIDTH,
		height: PDF_HEIGHT,
	})

	const target = new File(Paths.cache, model.fileName)
	if (target.exists) {
		target.delete()
	}
	const source = new File(printed.uri)
	await source.move(target)

	return {
		uri: target.uri,
		fileName: model.fileName,
		model,
		html,
	}
}

/** Open the system share sheet for a generated PDF. */
export async function shareCalendarPdf (
	uri: string,
	fileName: string,
): Promise<void> {
	const available = await Sharing.isAvailableAsync()
	if (!available) {
		throw new Error('SHARE_UNAVAILABLE')
	}
	await Sharing.shareAsync(uri, {
		mimeType: 'application/pdf',
		dialogTitle: fileName,
		UTI: 'com.adobe.pdf',
	})
}

/** Create the month PDF and open share. */
export async function createAndShareCalendarPdf (
	input: BuildMonthExportModelInput,
): Promise<CreatedCalendarPdf> {
	const created = await createCalendarPdf(input)
	await shareCalendarPdf(created.uri, created.fileName)
	return created
}
