/**
 * Integer money parsing, formatting and half-up kopeck rounding.
 */

import {
	applyBps,
	applyMultiplier,
	formatRublesDeltaFromMinor,
	formatRublesFromMinor,
	mulDivRound,
	parseMultiplierToHundredths,
	parsePercentToBps,
	parseRublesToMinor,
	payForMinutes,
} from '@/src/domain'

describe('parse rubles to kopecks', () => {
	it('accepts whole rubles, comma tenths and two decimals', () => {
		expect(parseRublesToMinor('450')).toEqual({ ok: true, value: 45_000 })
		expect(parseRublesToMinor('450,5')).toEqual({ ok: true, value: 45_050 })
		expect(parseRublesToMinor('450,50')).toEqual({ ok: true, value: 45_050 })
		expect(parseRublesToMinor('450.50')).toEqual({ ok: true, value: 45_050 })
		expect(parseRublesToMinor('0')).toEqual({ ok: true, value: 0 })
		expect(parseRublesToMinor('1 250,50')).toEqual({
			ok: true,
			value: 125_050,
		})
	})

	it('rejects empty, negative and invalid input', () => {
		expect(parseRublesToMinor('').ok).toBe(false)
		expect(parseRublesToMinor('   ').ok).toBe(false)
		expect(parseRublesToMinor('-1').ok).toBe(false)
		expect(parseRublesToMinor('abc').ok).toBe(false)
		expect(parseRublesToMinor('450,555').ok).toBe(false)
		expect(parseRublesToMinor('1,2,3').ok).toBe(false)
		expect(parseRublesToMinor('NaN').ok).toBe(false)
		expect(parseRublesToMinor('Infinity').ok).toBe(false)
	})
})

describe('format rubles', () => {
	it('hides whole-ruble kopecks and groups thousands', () => {
		expect(formatRublesFromMinor(45_000)).toBe('450 ₽')
		expect(formatRublesFromMinor(125_050)).toBe('1 250,50 ₽')
		expect(formatRublesFromMinor(8_290_000)).toBe('82 900 ₽')
		expect(formatRublesFromMinor(8_290_050)).toBe('82 900,50 ₽')
		expect(formatRublesDeltaFromMinor(640_000)).toBe('+6 400 ₽')
	})
})

describe('integer pay math', () => {
	it('pays 450 ₽/h for 12 h and 7 h 30 min without float money', () => {
		expect(payForMinutes(12 * 60, 45_000)).toBe(540_000)
		expect(payForMinutes(7 * 60 + 30, 45_000)).toBe(337_500)
		expect(applyBps(540_000, 2_000)).toBe(108_000)
		expect(applyMultiplier(90_000, 150)).toBe(135_000)
		expect(mulDivRound(7 * 60 + 30, 45_000, 60)).toBe(337_500)
	})

	it('parses percent and multiplier as integer-friendly units', () => {
		expect(parsePercentToBps('20')).toEqual({ ok: true, value: 2_000 })
		expect(parsePercentToBps('20,5')).toEqual({ ok: true, value: 2_050 })
		expect(parseMultiplierToHundredths('1,5')).toEqual({
			ok: true,
			value: 150,
		})
		expect(parseMultiplierToHundredths('2')).toEqual({
			ok: true,
			value: 200,
		})
		expect(parseMultiplierToHundredths('0').ok).toBe(false)
		expect(parseMultiplierToHundredths('6').ok).toBe(false)
	})
})
