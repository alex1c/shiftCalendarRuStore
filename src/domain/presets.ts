/**
 * Built-in schedule presets offered on first launch.
 * Custom-cycle editing is Phase 2 — the custom card is informational only.
 */

import type { SchedulePreset } from '@/src/types'
import {
	SHIFT_TYPE_DAY_ID,
	SHIFT_TYPE_NIGHT_ID,
	SHIFT_TYPE_OFF_ID,
} from './shift-types'

export const CUSTOM_PRESET_ID = 'custom'

const D = SHIFT_TYPE_DAY_ID
const N = SHIFT_TYPE_NIGHT_ID
const V = SHIFT_TYPE_OFF_ID

export const SCHEDULE_PRESETS: SchedulePreset[] = [
	{
		id: '2-2',
		name: '2/2',
		description: 'Два рабочих дня, затем два выходных.',
		cycle: [D, D, V, V],
	},
	{
		id: '1-1',
		name: '1/1',
		description: 'Рабочий день чередуется с выходным.',
		cycle: [D, V],
	},
	{
		id: '3-3',
		name: '3/3',
		description: 'Три рабочих дня, затем три выходных.',
		cycle: [D, D, D, V, V, V],
	},
	{
		id: '1-3',
		name: '1/3',
		description: 'Один рабочий день и три выходных.',
		cycle: [D, V, V, V],
	},
	{
		id: '5-2',
		name: '5/2',
		description: 'Пять рабочих дней и два выходных.',
		cycle: [D, D, D, D, D, V, V],
	},
	{
		id: 'day-night-48',
		name: 'День → Ночь → 48',
		description: 'День, ночь, затем двое суток отдыха.',
		cycle: [D, N, V, V],
	},
]

const PRESET_BY_ID = new Map(
	SCHEDULE_PRESETS.map((preset) => [preset.id, preset]),
)

export function getSchedulePreset (id: string): SchedulePreset | undefined {
	return PRESET_BY_ID.get(id)
}

export function requireSchedulePreset (id: string): SchedulePreset {
	const preset = getSchedulePreset(id)
	if (!preset) {
		throw new Error(`Unknown schedule preset: ${id}`)
	}
	return preset
}
