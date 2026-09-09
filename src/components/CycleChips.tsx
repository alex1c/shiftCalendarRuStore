/**
 * Compact visual cycle (Д  Д  В  В) used on preset cards and summaries.
 */

import { StyleSheet, Text, View } from 'react-native'

import { DEFAULT_SHIFT_TYPES } from '@/src/domain'
import type { ShiftType } from '@/src/types'
import {
	radius,
	shiftPalette,
	spacing,
	typography,
	useTheme,
} from '@/src/theme'

type CycleChipsProps = {
	cycle: readonly string[]
	shiftTypes?: readonly ShiftType[]
}

export function CycleChips ({
	cycle,
	shiftTypes = DEFAULT_SHIFT_TYPES,
}: CycleChipsProps) {
	const { colors } = useTheme()

	return (
		<View style={styles.row}>
			{cycle.map((shiftId, index) => {
				const shift = shiftTypes.find((item) => item.id === shiftId)
				const shortName = shift?.shortName ?? '?'
				const palette = shiftPalette(shift?.color ?? 'day', colors)
				return (
					<View
						key={`${shiftId}-${index}`}
						style={[
							styles.chip,
							{ backgroundColor: palette.background },
						]}
					>
						<Text
							style={[
								styles.letter,
								{ color: palette.foreground },
							]}
						>
							{shortName}
						</Text>
					</View>
				)
			})}
		</View>
	)
}

const styles = StyleSheet.create({
	row: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: spacing.xs,
	},
	chip: {
		minWidth: 32,
		minHeight: 32,
		paddingHorizontal: spacing.xs,
		borderRadius: radius.sm,
		alignItems: 'center',
		justifyContent: 'center',
	},
	letter: {
		...typography.bodyStrong,
	},
})
