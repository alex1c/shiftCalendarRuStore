/**
 * Edit persisted salary settings. Changes immediately recalculate
 * the salary screen on the way back.
 */

import { Alert } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'

import { SalarySettingsForm } from '@/src/components/SalarySettingsForm'
import { Screen } from '@/src/components/Screen'
import { useAdsProtectedFlow } from '@/src/ads'
import type { SalarySettings } from '@/src/domain'
import { useAppBootstrap } from '@/src/features/bootstrap/AppBootstrap'
import type { MoreStackParamList } from '@/src/navigation/types'

type Props = NativeStackScreenProps<MoreStackParamList, 'SalarySettings'>

export function SalarySettingsScreen ({ navigation }: Props) {
	const {
		salarySettings,
		persistSalarySettings,
		resetSalarySettings,
	} = useAppBootstrap()
	useAdsProtectedFlow()

	const handleSave = (next: SalarySettings) => {
		void (async () => {
			await persistSalarySettings(next)
			navigation.goBack()
		})()
	}

	const handleDisable = () => {
		if (!salarySettings) {
			return
		}
		Alert.alert(
			'Отключить расчёт?',
			'Ставка сохранится, но расчётный заработок скрывается.',
			[
				{ text: 'Отмена', style: 'cancel' },
				{
					text: 'Отключить',
					onPress: () => {
						void (async () => {
							await persistSalarySettings({
								...salarySettings,
								enabled: false,
								updatedAt: new Date().toISOString(),
							})
							navigation.goBack()
						})()
					},
				},
			],
		)
	}

	const handleReset = () => {
		Alert.alert(
			'Сбросить настройки оплаты?',
			'Ставка и надбавки будут удалены. График смен не изменится.',
			[
				{ text: 'Отмена', style: 'cancel' },
				{
					text: 'Сбросить',
					style: 'destructive',
					onPress: () => {
						void (async () => {
							await resetSalarySettings()
							navigation.goBack()
						})()
					},
				},
			],
		)
	}

	return (
		<Screen includeBottomSafeArea={false}>
			<SalarySettingsForm
				initial={salarySettings}
				onSave={handleSave}
				onDisable={handleDisable}
				onReset={handleReset}
			/>
		</Screen>
	)
}
