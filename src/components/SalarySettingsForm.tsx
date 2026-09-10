/**
 * Shared salary settings form for first-open setup and later edits.
 * Primary save sits after the rate so it stays above the fold on Pixel 4a.
 */

import { useMemo, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import {
	AppButton,
	AppSwitchRow,
	AppTextField,
	SurfaceCard,
} from '@/src/components/ui'
import {
	defaultSalarySettings,
	formatMultiplierFromHundredths,
	formatPercentFromBps,
	formatRublesInputFromMinor,
	formatSalaryPreview,
	parseMultiplierToHundredths,
	parsePercentToBps,
	parseRublesToMinor,
	type SalaryMode,
	type SalarySettings,
} from '@/src/domain'
import { radius, spacing, touchTarget, typography, useTheme } from '@/src/theme'

type FormErrors = {
	rate?: string
	night?: string
	overtimeMultiplier?: string
	overtimeRate?: string
	extra?: string
}

type SalarySettingsFormProps = {
	initial: SalarySettings | null
	firstOpen?: boolean
	onSave: (settings: SalarySettings) => void
	onDisable?: () => void
	onReset?: () => void
}

function rateFromSettings (
	settings: SalarySettings | null,
	mode: SalaryMode,
): string {
	if (!settings) {
		return ''
	}
	return formatRublesInputFromMinor(
		mode === 'hourly'
			? settings.hourlyRateMinor
			: settings.shiftRateMinor,
	)
}

export function SalarySettingsForm ({
	initial,
	firstOpen = false,
	onSave,
	onDisable,
	onReset,
}: SalarySettingsFormProps) {
	const { colors } = useTheme()
	const seed = useMemo(
		() => initial ?? defaultSalarySettings(),
		[initial],
	)
	const [mode, setMode] = useState<SalaryMode>(seed.mode)
	const [rate, setRate] = useState(() => rateFromSettings(seed, seed.mode))
	const [nightBonusEnabled, setNightBonusEnabled] = useState(
		seed.nightBonusEnabled,
	)
	const [nightBonus, setNightBonus] = useState(
		formatPercentFromBps(seed.nightBonusBps) || '20',
	)
	const [overtimeEnabled, setOvertimeEnabled] = useState(
		seed.overtimeEnabled,
	)
	const [overtimeMultiplier, setOvertimeMultiplier] = useState(
		formatMultiplierFromHundredths(seed.overtimeMultiplierHundredths) ||
			'1,5',
	)
	const [overtimeHourlyRate, setOvertimeHourlyRate] = useState(
		formatRublesInputFromMinor(seed.overtimeHourlyRateMinor),
	)
	const [extraMultiplier, setExtraMultiplier] = useState(
		formatMultiplierFromHundredths(seed.extraShiftMultiplierHundredths) ||
			'1',
	)
	const [errors, setErrors] = useState<FormErrors>({})

	const draftSettings = useMemo((): SalarySettings | null => {
		const parsedRate = parseRublesToMinor(rate)
		const parsedNight = parsePercentToBps(nightBonus)
		const parsedOvertimeMult = parseMultiplierToHundredths(
			overtimeMultiplier,
		)
		const parsedExtra = parseMultiplierToHundredths(extraMultiplier)
		const parsedOvertimeRate =
			overtimeHourlyRate.trim().length === 0
				? { ok: true as const, value: 0 }
				: parseRublesToMinor(overtimeHourlyRate)
		if (
			!parsedRate.ok ||
			parsedRate.value <= 0 ||
			(nightBonusEnabled && !parsedNight.ok) ||
			(overtimeEnabled && !parsedOvertimeMult.ok) ||
			!parsedExtra.ok ||
			!parsedOvertimeRate.ok
		) {
			return null
		}
		return {
			...seed,
			enabled: true,
			mode,
			hourlyRateMinor:
				mode === 'hourly' ? parsedRate.value : seed.hourlyRateMinor,
			shiftRateMinor:
				mode === 'shift' ? parsedRate.value : seed.shiftRateMinor,
			nightBonusEnabled,
			nightBonusBps: parsedNight.ok
				? parsedNight.value
				: seed.nightBonusBps,
			overtimeEnabled,
			overtimeMultiplierHundredths: parsedOvertimeMult.ok
				? parsedOvertimeMult.value
				: seed.overtimeMultiplierHundredths,
			overtimeHourlyRateMinor: parsedOvertimeRate.value,
			extraShiftMultiplierHundredths: parsedExtra.value,
		}
	}, [
		extraMultiplier,
		mode,
		nightBonus,
		nightBonusEnabled,
		overtimeEnabled,
		overtimeHourlyRate,
		overtimeMultiplier,
		rate,
		seed,
	])

	const preview = draftSettings
		? formatSalaryPreview(draftSettings)
		: []

	const handleModeChange = (next: SalaryMode) => {
		setMode(next)
		const stored = rateFromSettings(seed, next)
		if (stored.length > 0) {
			setRate(stored)
		}
		setErrors((current) => ({ ...current, rate: undefined }))
	}

	const handleSave = () => {
		const nextErrors: FormErrors = {}
		const parsedRate = parseRublesToMinor(rate)
		if (!parsedRate.ok) {
			nextErrors.rate = parsedRate.message
		} else if (parsedRate.value <= 0) {
			nextErrors.rate = 'Укажите ставку больше нуля.'
		}

		let nightBps = seed.nightBonusBps
		if (nightBonusEnabled) {
			const parsedNight = parsePercentToBps(nightBonus)
			if (!parsedNight.ok) {
				nextErrors.night = parsedNight.message
			} else {
				nightBps = parsedNight.value
			}
		}

		let overtimeHundredths = seed.overtimeMultiplierHundredths
		if (overtimeEnabled) {
			const parsedOvertimeMult = parseMultiplierToHundredths(
				overtimeMultiplier,
			)
			if (!parsedOvertimeMult.ok) {
				nextErrors.overtimeMultiplier = parsedOvertimeMult.message
			} else {
				overtimeHundredths = parsedOvertimeMult.value
			}
		}

		let overtimeRateMinor = 0
		if (overtimeHourlyRate.trim().length > 0) {
			const parsedOvertimeRate = parseRublesToMinor(overtimeHourlyRate)
			if (!parsedOvertimeRate.ok) {
				nextErrors.overtimeRate = parsedOvertimeRate.message
			} else {
				overtimeRateMinor = parsedOvertimeRate.value
			}
		}

		const parsedExtra = parseMultiplierToHundredths(extraMultiplier)
		let extraHundredths = seed.extraShiftMultiplierHundredths
		if (!parsedExtra.ok) {
			nextErrors.extra = parsedExtra.message
		} else {
			extraHundredths = parsedExtra.value
		}

		setErrors(nextErrors)
		if (Object.keys(nextErrors).length > 0 || !parsedRate.ok) {
			return
		}

		const now = new Date().toISOString()
		onSave({
			enabled: true,
			mode,
			hourlyRateMinor:
				mode === 'hourly' ? parsedRate.value : seed.hourlyRateMinor,
			shiftRateMinor:
				mode === 'shift' ? parsedRate.value : seed.shiftRateMinor,
			nightBonusEnabled,
			nightBonusBps: nightBps,
			overtimeEnabled,
			overtimeMultiplierHundredths: overtimeHundredths,
			overtimeHourlyRateMinor: overtimeRateMinor,
			extraShiftMultiplierHundredths: extraHundredths,
			createdAt: seed.createdAt || now,
			updatedAt: now,
		})
	}

	const rateLabel =
		mode === 'hourly' ? 'Ставка за час' : 'Ставка за смену'
	const ratePlaceholder = mode === 'hourly' ? '450' : '5000'

	return (
		<View style={styles.root}>
			<SurfaceCard style={styles.card}>
				<Text style={[styles.section, { color: colors.textTertiary }]}>
					Способ оплаты
				</Text>
				<View style={styles.modeRow}>
					{(
						[
							{ id: 'hourly', label: 'Почасовая' },
							{ id: 'shift', label: 'За смену' },
						] as const
					).map((option) => {
						const selected = mode === option.id
						return (
							<Pressable
								key={option.id}
								accessibilityRole="button"
								accessibilityState={{ selected }}
								onPress={() => handleModeChange(option.id)}
								style={({ pressed }) => [
									styles.modeChip,
									{
										backgroundColor: selected
											? colors.primaryMuted
											: colors.background,
										borderColor: selected
											? colors.primary
											: colors.border,
										opacity: pressed ? 0.85 : 1,
									},
								]}
							>
								<Text
									style={[
										styles.modeLabel,
										{
											color: selected
												? colors.primary
												: colors.textPrimary,
										},
									]}
								>
									{option.label}
								</Text>
							</Pressable>
						)
					})}
				</View>
				<AppTextField
					label={rateLabel}
					value={rate}
					onChangeText={setRate}
					placeholder={ratePlaceholder}
					keyboardType="decimal-pad"
					error={errors.rate}
					accessibilityLabel={rateLabel}
				/>
				{preview.map((line) => (
					<Text
						key={line}
						style={[styles.preview, { color: colors.textSecondary }]}
					>
						{line}
					</Text>
				))}
				<AppButton label="Сохранить" onPress={handleSave} />
			</SurfaceCard>

			<SurfaceCard style={styles.card}>
				<AppSwitchRow
					label="Доплата за ночные"
					value={nightBonusEnabled}
					onValueChange={setNightBonusEnabled}
				/>
				{nightBonusEnabled ? (
					<AppTextField
						label="Надбавка, %"
						value={nightBonus}
						onChangeText={setNightBonus}
						placeholder="20"
						keyboardType="decimal-pad"
						error={errors.night}
					/>
				) : null}
			</SurfaceCard>

			<SurfaceCard style={styles.card}>
				<AppSwitchRow
					label="Оплата переработки"
					value={overtimeEnabled}
					onValueChange={setOvertimeEnabled}
				/>
				{overtimeEnabled ? (
					<>
						<AppTextField
							label="Коэффициент"
							value={overtimeMultiplier}
							onChangeText={setOvertimeMultiplier}
							placeholder="1,5"
							keyboardType="decimal-pad"
							error={errors.overtimeMultiplier}
						/>
						{mode === 'shift' ? (
							<AppTextField
								label="Оплата переработки за час"
								value={overtimeHourlyRate}
								onChangeText={setOvertimeHourlyRate}
								placeholder="600"
								keyboardType="decimal-pad"
								error={errors.overtimeRate}
							/>
						) : null}
					</>
				) : null}
			</SurfaceCard>

			<SurfaceCard style={styles.card}>
				<Text style={[styles.section, { color: colors.textPrimary }]}>
					Дополнительная смена
				</Text>
				<AppTextField
					label="Коэффициент дополнительной смены"
					value={extraMultiplier}
					onChangeText={setExtraMultiplier}
					placeholder="1"
					keyboardType="decimal-pad"
					error={errors.extra}
				/>
			</SurfaceCard>

			<AppButton label="Сохранить" onPress={handleSave} />

			{!firstOpen && onDisable ? (
				<AppButton
					label="Отключить расчёт зарплаты"
					variant="secondary"
					onPress={onDisable}
				/>
			) : null}
			{!firstOpen && onReset ? (
				<AppButton
					label="Сбросить настройки оплаты"
					variant="danger"
					onPress={onReset}
				/>
			) : null}
		</View>
	)
}

const styles = StyleSheet.create({
	root: {
		gap: spacing.md,
		paddingBottom: spacing.xxl,
	},
	card: {
		gap: spacing.md,
	},
	section: {
		...typography.label,
	},
	modeRow: {
		flexDirection: 'row',
		gap: spacing.sm,
	},
	modeChip: {
		flex: 1,
		minHeight: touchTarget.min,
		borderRadius: radius.md,
		borderWidth: 1.5,
		alignItems: 'center',
		justifyContent: 'center',
		paddingHorizontal: spacing.sm,
	},
	modeLabel: {
		...typography.bodyStrong,
	},
	preview: {
		...typography.caption,
	},
})
