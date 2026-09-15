/**
 * Built-in learning guide — scrollable cards covering core features.
 * Does not mutate user schedule data.
 */

import { StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'

import { Screen } from '@/src/components/Screen'
import { SurfaceCard } from '@/src/components/ui'
import { useAdsProtectedFlow } from '@/src/ads'
import {
	TUTORIAL_SECTIONS,
	type TutorialSection,
} from '@/src/learning'
import { radius, spacing, typography, useTheme } from '@/src/theme'

export function LearningScreen () {
	const { colors } = useTheme()
	useAdsProtectedFlow()

	return (
		<Screen
			includeBottomSafeArea={false}
			contentStyle={styles.content}
		>
			<Text style={[styles.lead, { color: colors.textSecondary }]}>
				Краткий справочник по основным возможностям. Открывайте его
				в любое время — данные графика не меняются.
			</Text>

			<View style={styles.list}>
				{TUTORIAL_SECTIONS.map((section) => (
					<TutorialCard key={section.id} section={section} />
				))}
			</View>
		</Screen>
	)
}

type TutorialCardProps = {
	section: TutorialSection
}

function TutorialCard ({ section }: TutorialCardProps) {
	const { colors } = useTheme()

	return (
		<SurfaceCard style={styles.card}>
			<View style={styles.cardHeader}>
				<View
					style={[
						styles.iconWrap,
						{ backgroundColor: colors.primaryMuted },
					]}
					accessible={false}
				>
					<Ionicons
						name={section.icon}
						size={22}
						color={colors.primary}
					/>
				</View>
				<Text
					style={[styles.cardTitle, { color: colors.textPrimary }]}
					accessibilityRole="header"
				>
					{section.title}
				</Text>
			</View>

			{section.paragraphs.map((paragraph) => (
				<Text
					key={paragraph}
					style={[styles.paragraph, { color: colors.textSecondary }]}
				>
					{paragraph}
				</Text>
			))}

			{section.bullets && section.bullets.length > 0 ? (
				<View style={styles.bullets}>
					{section.bullets.map((item) => (
						<Text
							key={item}
							style={[
								styles.bullet,
								{ color: colors.textSecondary },
							]}
						>
							• {item}
						</Text>
					))}
				</View>
			) : null}

			{section.routes && section.routes.length > 0 ? (
				<View
					style={styles.routes}
					accessibilityRole="text"
					accessibilityLabel={`Путь: ${section.routes.join(' → ')}`}
				>
					{section.routes.map((step) => (
						<View
							key={`${section.id}-${step}`}
							style={[
								styles.routeChip,
								{
									backgroundColor: colors.surfaceMuted,
									borderColor: colors.border,
								},
							]}
							accessible={false}
							importantForAccessibility="no"
						>
							<Text
								style={[
									styles.routeText,
									{ color: colors.textPrimary },
								]}
							>
								{step}
							</Text>
						</View>
					))}
				</View>
			) : null}
		</SurfaceCard>
	)
}

const styles = StyleSheet.create({
	content: {
		paddingBottom: spacing.xxl,
	},
	lead: {
		...typography.body,
		marginBottom: spacing.md,
	},
	list: {
		gap: spacing.md,
		paddingBottom: spacing.xl,
	},
	card: {
		gap: spacing.xs,
	},
	cardHeader: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: spacing.sm,
		marginBottom: spacing.xs,
	},
	iconWrap: {
		width: 40,
		height: 40,
		borderRadius: radius.md,
		alignItems: 'center',
		justifyContent: 'center',
	},
	cardTitle: {
		...typography.subtitle,
		flex: 1,
	},
	paragraph: {
		...typography.body,
	},
	bullets: {
		gap: spacing.xxs,
		marginTop: spacing.xxs,
	},
	bullet: {
		...typography.body,
	},
	routes: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: spacing.xs,
		marginTop: spacing.sm,
	},
	routeChip: {
		borderWidth: 1,
		borderRadius: radius.sm,
		paddingHorizontal: spacing.sm,
		paddingVertical: spacing.xxs,
		// Not a button — visual path badge only.
		minHeight: 28,
		justifyContent: 'center',
	},
	routeText: {
		...typography.caption,
		fontWeight: '600',
	},
})
