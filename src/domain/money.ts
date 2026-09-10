/**
 * Integer money helpers. All monetary values are kopecks (minor units).
 * Never store or accumulate earnings in floating-point rubles.
 *
 * Rounding: half-up toward +infinity for non-negative BigInt division.
 * 20% is 2000 basis points (10_000 = 100%). 1.5× is 150 hundredths.
 */

/** One ruble expressed in kopecks. */
export const KOPECKS_PER_RUBLE = 100

/** 10_000 basis points = 100%. */
export const BPS_PER_UNIT = 10_000

/** 100 hundredths = 1.00×. */
export const MULTIPLIER_HUNDREDTHS = 100

/** Hard cap: 10_000_000 ₽ so stored integers stay well inside Number. */
export const MAX_MONEY_MINOR = 10_000_000 * KOPECKS_PER_RUBLE

export const DEFAULT_NIGHT_BONUS_BPS = 2_000
export const DEFAULT_OVERTIME_MULTIPLIER_HUNDREDTHS = 150
export const DEFAULT_EXTRA_SHIFT_MULTIPLIER_HUNDREDTHS = 100

export const MIN_MULTIPLIER_HUNDREDTHS = 100
export const MAX_MULTIPLIER_HUNDREDTHS = 500
export const MAX_NIGHT_BONUS_BPS = 20_000

export type ParseResult =
	| { ok: true; value: number }
	| { ok: false; message: string }

/**
 * (a × b) / denom with half-up rounding. Inputs must be finite non-negative
 * integers; denom must be a positive integer.
 */
export function mulDivRound (
	a: number,
	b: number,
	denom: number,
): number {
	if (
		!Number.isInteger(a) ||
		!Number.isInteger(b) ||
		!Number.isInteger(denom) ||
		a < 0 ||
		b < 0 ||
		denom <= 0
	) {
		return 0
	}
	const product = BigInt(a) * BigInt(b)
	const d = BigInt(denom)
	return Number((product + d / 2n) / d)
}

/**
 * Paid kopecks for `minutes` at `rateMinor` kopecks per hour.
 * 450 ₽/h × 7 h 30 min → 337_500 kopecks (3 375 ₽).
 */
export function payForMinutes (
	minutes: number,
	rateMinor: number,
): number {
	if (
		!Number.isInteger(minutes) ||
		!Number.isInteger(rateMinor) ||
		minutes <= 0 ||
		rateMinor <= 0
	) {
		return 0
	}
	return mulDivRound(minutes, rateMinor, 60)
}

/** Apply a basis-point surcharge to an already-rounded minor amount. */
export function applyBps (amountMinor: number, bps: number): number {
	if (
		!Number.isInteger(amountMinor) ||
		!Number.isInteger(bps) ||
		amountMinor <= 0 ||
		bps <= 0
	) {
		return 0
	}
	return mulDivRound(amountMinor, bps, BPS_PER_UNIT)
}

/** Apply a × hundredths multiplier (150 = 1.5×) to a minor amount. */
export function applyMultiplier (
	amountMinor: number,
	hundredths: number,
): number {
	if (
		!Number.isInteger(amountMinor) ||
		!Number.isInteger(hundredths) ||
		amountMinor <= 0 ||
		hundredths <= 0
	) {
		return 0
	}
	return mulDivRound(amountMinor, hundredths, MULTIPLIER_HUNDREDTHS)
}

function stripMoneyNoise (raw: string): string {
	return raw
		.trim()
		.replace(/\u00a0/g, '')
		.replace(/\s+/g, '')
}

/**
 * Parse a Russian (or dotted) ruble string into kopecks.
 * Accepts `450`, `450,5`, `450,50`, `450.50`. Rejects negatives and junk.
 */
export function parseRublesToMinor (raw: string): ParseResult {
	const trimmed = stripMoneyNoise(raw)
	if (trimmed.length === 0) {
		return { ok: false, message: 'Укажите сумму.' }
	}
	if (trimmed.startsWith('-')) {
		return { ok: false, message: 'Сумма не может быть отрицательной.' }
	}
	if (!/^\d+([.,]\d{1,2})?$/.test(trimmed)) {
		return { ok: false, message: 'Некорректная сумма.' }
	}
	const normalized = trimmed.replace(',', '.')
	const [wholePart, fractionPart = ''] = normalized.split('.')
	const kopecks = Number((fractionPart + '00').slice(0, 2))
	const whole = Number(wholePart)
	if (!Number.isSafeInteger(whole) || !Number.isInteger(kopecks)) {
		return { ok: false, message: 'Некорректная сумма.' }
	}
	const minor = whole * KOPECKS_PER_RUBLE + kopecks
	if (minor > MAX_MONEY_MINOR) {
		return { ok: false, message: 'Слишком большая сумма.' }
	}
	return { ok: true, value: minor }
}

/**
 * Percent string → basis points. `20` → 2000, `20,5` → 2050.
 */
export function parsePercentToBps (raw: string): ParseResult {
	if (stripMoneyNoise(raw).length === 0) {
		return { ok: false, message: 'Укажите процент.' }
	}
	const parsed = parseRublesToMinor(raw)
	if (!parsed.ok) {
		return { ok: false, message: 'Некорректный процент.' }
	}
	if (parsed.value > MAX_NIGHT_BONUS_BPS) {
		return { ok: false, message: 'Процент слишком большой.' }
	}
	return parsed
}

/**
 * Multiplier string → hundredths. `1,5` → 150, `2` → 200.
 */
export function parseMultiplierToHundredths (raw: string): ParseResult {
	const parsed = parseRublesToMinor(raw)
	if (!parsed.ok) {
		return {
			ok: false,
			message: 'Некорректный коэффициент.',
		}
	}
	if (
		parsed.value < MIN_MULTIPLIER_HUNDREDTHS ||
		parsed.value > MAX_MULTIPLIER_HUNDREDTHS
	) {
		return {
			ok: false,
			message: 'Коэффициент должен быть от 1 до 5.',
		}
	}
	return parsed
}

function groupThousands (digits: string): string {
	return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
}

/**
 * Russian ruble display. Whole rubles omit `,00`; kopecks use a comma.
 * Examples: `450 ₽`, `1 250,50 ₽`, `82 900 ₽`.
 */
export function formatRublesFromMinor (minor: number): string {
	const safe = Number.isFinite(minor) ? Math.trunc(minor) : 0
	const sign = safe < 0 ? '−' : ''
	const abs = Math.abs(safe)
	const rubles = Math.floor(abs / KOPECKS_PER_RUBLE)
	const kopecks = abs % KOPECKS_PER_RUBLE
	const grouped = groupThousands(String(rubles))
	if (kopecks === 0) {
		return `${sign}${grouped} ₽`
	}
	const frac = String(kopecks).padStart(2, '0')
	return `${sign}${grouped},${frac} ₽`
}

/** Signed breakdown amount: `+6 400 ₽`. */
export function formatRublesDeltaFromMinor (minor: number): string {
	if (minor === 0) {
		return formatRublesFromMinor(0)
	}
	const formatted = formatRublesFromMinor(Math.abs(minor))
	return minor < 0 ? `−${formatted}` : `+${formatted}`
}

/**
 * Format kopecks as a ruble input string (`450` / `450,5` / `1 250,50`).
 */
export function formatRublesInputFromMinor (minor: number): string {
	if (!Number.isInteger(minor) || minor <= 0) {
		return ''
	}
	const rubles = Math.floor(minor / KOPECKS_PER_RUBLE)
	const kopecks = minor % KOPECKS_PER_RUBLE
	if (kopecks === 0) {
		return String(rubles)
	}
	if (kopecks % 10 === 0) {
		return `${rubles},${kopecks / 10}`
	}
	return `${rubles},${String(kopecks).padStart(2, '0')}`
}

export function formatPercentFromBps (bps: number): string {
	if (!Number.isInteger(bps) || bps <= 0) {
		return ''
	}
	return formatRublesInputFromMinor(bps)
}

export function formatMultiplierFromHundredths (hundredths: number): string {
	if (!Number.isInteger(hundredths) || hundredths <= 0) {
		return ''
	}
	return formatRublesInputFromMinor(hundredths)
}
