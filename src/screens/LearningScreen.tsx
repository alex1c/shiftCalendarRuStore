/**
 * In-app learning cards. Required in every ForestMusic app, even in Phase 1.
 */

import { StyleSheet, Text, View } from 'react-native'

import { Screen } from '@/src/components/Screen'
import { SurfaceCard } from '@/src/components/ui'
import { spacing, typography, useTheme } from '@/src/theme'

const CARDS = [
	{
		title: 'Как читать календарь',
		body:
			'Буква на дне показывает тип смены: Д — дневная (08:00–20:00), ' +
			'Н — ночная (20:00–08:00), В — выходной. Цвет помогает, но не ' +
			'заменяет букву.',
	},
	{
		title: 'Как работает цикл',
		body:
			'Выбранная последовательность повторяется снова и снова от даты ' +
			'начала. Календарь не хранит тысячи дат — смена на любой день ' +
			'считается из цикла, в том числе в прошлых месяцах.',
	},
	{
		title: 'Как изменить график',
		body:
			'Сейчас график можно сбросить в разделе «Ещё → Мой график» и ' +
			'создать заново, в том числе собрать свой цикл. Полноценное ' +
			'редактирование уже сохранённого графика появится далее.',
	},
] as const

export function LearningScreen () {
	const { colors } = useTheme()

	return (
		<Screen includeBottomSafeArea={false}>
			<View style={styles.list}>
				{CARDS.map((card) => (
					<SurfaceCard key={card.title}>
						<Text
							style={[
								styles.cardTitle,
								{ color: colors.textPrimary },
							]}
						>
							{card.title}
						</Text>
						<Text
							style={[
								styles.cardBody,
								{ color: colors.textSecondary },
							]}
						>
							{card.body}
						</Text>
					</SurfaceCard>
				))}
			</View>
		</Screen>
	)
}

const styles = StyleSheet.create({
	list: {
		gap: spacing.md,
		paddingBottom: spacing.xl,
	},
	cardTitle: {
		...typography.subtitle,
		marginBottom: spacing.xs,
	},
	cardBody: {
		...typography.body,
	},
})
