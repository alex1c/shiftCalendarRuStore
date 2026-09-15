/**
 * About screen — product name, developer, version, privacy pointer.
 */

import { Linking, Pressable, StyleSheet, Text } from 'react-native'

import { Screen } from '@/src/components/Screen'
import { SurfaceCard } from '@/src/components/ui'
import { spacing, typography, useTheme } from '@/src/theme'

const DEVELOPER_SITE = 'https://forest-music.ru'
const PRIVACY_URL =
	'https://alex1c.github.io/shiftCalendarRuStore/privacy.html'
const CONTACT_EMAIL = 'rustore-alex1c@yandex.ru'

export function AboutScreen () {
	const { colors } = useTheme()

	return (
		<Screen includeBottomSafeArea={false}>
			<SurfaceCard>
				<Text style={[styles.name, { color: colors.textPrimary }]}>
					Мой график смен
				</Text>
				<Text style={[styles.meta, { color: colors.textSecondary }]}>
					ForestMusic
				</Text>
				<Text style={[styles.meta, { color: colors.textSecondary }]}>
					Версия 1.0.0
				</Text>
				<Text style={[styles.body, { color: colors.textSecondary }]}>
					Календарь рабочих графиков для сменной работы. Основные
					данные графика хранятся на этом устройстве. Для аналитики и
					рекламы используются сторонние SDK — подробности в политике
					конфиденциальности.
				</Text>
				<Pressable
					accessibilityRole="link"
					accessibilityLabel="Открыть сайт ForestMusic"
					onPress={() => {
						void Linking.openURL(DEVELOPER_SITE)
					}}
					style={styles.linkRow}
				>
					<Text style={[styles.link, { color: colors.primary }]}>
						{DEVELOPER_SITE}
					</Text>
				</Pressable>
				<Pressable
					accessibilityRole="link"
					accessibilityLabel="Открыть политику конфиденциальности"
					onPress={() => {
						void Linking.openURL(PRIVACY_URL)
					}}
					style={styles.linkRow}
				>
					<Text style={[styles.link, { color: colors.primary }]}>
						Политика конфиденциальности
					</Text>
				</Pressable>
				<Pressable
					accessibilityRole="link"
					accessibilityLabel="Написать разработчику"
					onPress={() => {
						void Linking.openURL(`mailto:${CONTACT_EMAIL}`)
					}}
					style={styles.linkRow}
				>
					<Text style={[styles.link, { color: colors.primary }]}>
						{CONTACT_EMAIL}
					</Text>
				</Pressable>
			</SurfaceCard>
		</Screen>
	)
}

const styles = StyleSheet.create({
	name: {
		...typography.title,
		marginBottom: spacing.xs,
	},
	meta: {
		...typography.caption,
		marginBottom: spacing.xxs,
	},
	body: {
		...typography.body,
		marginTop: spacing.md,
	},
	linkRow: {
		marginTop: spacing.sm,
		minHeight: 48,
		justifyContent: 'center',
	},
	link: {
		...typography.bodyStrong,
	},
})
