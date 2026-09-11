/**
 * Estimated earnings: first-open setup or period breakdown.
 */

import { useCallback, useMemo, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'

import { PeriodChips } from '@/src/components/PeriodChips'
import { SalarySettingsForm } from '@/src/components/SalarySettingsForm'
import { Screen } from '@/src/components/Screen'
import { AppButton, SurfaceCard } from '@/src/components/ui'
import {
	computeSalaryForPeriod,
	formatRublesDeltaFromMinor,
	formatRublesFromMinor,
	formatStatsPeriodLabel,
	isSalaryEnabled,
	resolveStatsPeriod,
	type SalarySettings,
	type StatsPeriodKind,
} from '@/src/domain'
import { useAppBootstrap } from '@/src/features/bootstrap/AppBootstrap'
import type { MoreStackParamList } from '@/src/navigation/types'
import { spacing, typography, useTheme } from '@/src/theme'

type Props = NativeStackScreenProps<MoreStackParamList, 'Salary'>

export function SalaryScreen ({ navigation }: Props) {
	const { colors } = useTheme()
	const {
		schedule,
		overrides,
		salarySettings,
		persistSalarySettings,
		primaryProfile,
		activeProfile,
	} = useAppBootstrap()
	const [period, setPeriod] = useState<StatsPeriodKind>('30')
	const [now, setNow] = useState(() => new Date())

	useFocusEffect(
		useCallback(() => {
			setNow(new Date())
		}, []),
	)

	const salarySchedule = primaryProfile?.schedule ?? schedule
	const salaryOverrides = primaryProfile?.overrides ?? overrides
	const enabled = isSalaryEnabled(salarySettings)

	const range = useMemo(() => {
		if (!salarySchedule || !enabled) {
			return null
		}
		return resolveStatsPeriod(period, salarySchedule.startDate, now)
	}, [salarySchedule, enabled, period, now])

	const totals = useMemo(() => {
		if (!salarySchedule || !range || !salarySettings || !enabled) {
			return null
		}
		return computeSalaryForPeriod(
			salarySchedule,
			salaryOverrides,
			salarySettings,
			range.startDate,
			range.endDate,
		)
	}, [salarySchedule, salaryOverrides, salarySettings, range, enabled])

	const handleSave = (next: SalarySettings) => {
		void persistSalarySettings(next)
	}

	if (!schedule) {
		return (
			<Screen includeBottomSafeArea={false}>
				<Text style={[styles.lead, { color: colors.textPrimary }]}>
					Сначала создайте график
				</Text>
			</Screen>
		)
	}

	if (!enabled) {
		return (
			<Screen includeBottomSafeArea={false}>
				{primaryProfile ? (
					<Text style={[styles.owner, { color: colors.textSecondary }]}>
						{`График: ${primaryProfile.name}`}
					</Text>
				) : null}
				<Text
					style={[styles.lead, { color: colors.textSecondary }]}
				>
					Укажите способ оплаты. Расчёт является ориентировочным и
					зависит от введённых вами данных.
				</Text>
				<SalarySettingsForm
					initial={salarySettings}
					firstOpen
					onSave={handleSave}
				/>
			</Screen>
		)
	}

	if (!range || !totals) {
		return null
	}

	const periodLabel = formatStatsPeriodLabel(period, range)

	return (
		<Screen includeBottomSafeArea={false}>
			{primaryProfile ? (
				<Text style={[styles.owner, { color: colors.textSecondary }]}>
					{`График: ${primaryProfile.name}`}
				</Text>
			) : null}
			{activeProfile &&
			primaryProfile &&
			activeProfile.id !== primaryProfile.id ? (
				<Text style={[styles.owner, { color: colors.textTertiary }]}>
					Расчёт зарплаты считается только для основного графика.
				</Text>
			) : null}
			<PeriodChips value={period} onChange={setPeriod} />
			<Text style={[styles.range, { color: colors.textSecondary }]}>
				{periodLabel}
			</Text>

			<SurfaceCard style={styles.totalCard}>
				<Text style={[styles.totalLabel, { color: colors.textTertiary }]}>
					Расчётно
				</Text>
				<Text style={[styles.totalValue, { color: colors.textPrimary }]}>
					{formatRublesFromMinor(totals.totalPayMinor)}
				</Text>
			</SurfaceCard>

			<SurfaceCard style={styles.breakdown}>
				<BreakdownRow
					label="Основная оплата"
					value={formatRublesFromMinor(totals.regularPayMinor)}
				/>
				<BreakdownRow
					label="Ночные"
					value={formatRublesDeltaFromMinor(totals.nightBonusMinor)}
				/>
				<BreakdownRow
					label="Переработка"
					value={formatRublesDeltaFromMinor(totals.overtimePayMinor)}
				/>
				<BreakdownRow
					label="Доп. смены"
					value={formatRublesDeltaFromMinor(totals.extraShiftPayMinor)}
				/>
			</SurfaceCard>

			<Text style={[styles.disclaimer, { color: colors.textTertiary }]}>
				Расчёт ориентировочный и не является расчётным листком
				работодателя.
			</Text>
			<Text style={[styles.disclaimer, { color: colors.textTertiary }]}>
				Отпускные, больничные, налоги и другие начисления не
				учитываются.
			</Text>
			<Text style={[styles.note, { color: colors.textSecondary }]}>
				Отпускные и больничные в расчёт не входят.
			</Text>

			<View style={styles.footer}>
				<AppButton
					label="Настройки оплаты"
					variant="secondary"
					onPress={() => navigation.navigate('SalarySettings')}
				/>
			</View>
		</Screen>
	)
}

type BreakdownRowProps = {
	label: string
	value: string
}

function BreakdownRow ({ label, value }: BreakdownRowProps) {
	const { colors } = useTheme()
	return (
		<View style={styles.row}>
			<Text style={[styles.rowLabel, { color: colors.textSecondary }]}>
				{label}
			</Text>
			<Text style={[styles.rowValue, { color: colors.textPrimary }]}>
				{value}
			</Text>
		</View>
	)
}

const styles = StyleSheet.create({
	lead: {
		...typography.body,
		marginBottom: spacing.md,
	},
	owner: {
		...typography.caption,
		marginBottom: spacing.sm,
	},
	range: {
		...typography.caption,
		marginBottom: spacing.md,
	},
	totalCard: {
		gap: spacing.xxs,
		marginBottom: spacing.sm,
	},
	totalLabel: {
		...typography.label,
	},
	totalValue: {
		...typography.display,
	},
	breakdown: {
		gap: spacing.sm,
		marginBottom: spacing.md,
	},
	row: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		gap: spacing.sm,
		minHeight: 28,
	},
	rowLabel: {
		...typography.body,
	},
	rowValue: {
		...typography.bodyStrong,
	},
	disclaimer: {
		...typography.caption,
		marginBottom: spacing.xs,
	},
	note: {
		...typography.caption,
		marginBottom: spacing.md,
	},
	footer: {
		paddingBottom: spacing.xl,
	},
})
