export const SUPPORTED_CURRENCIES = [
  "NGN", "GHS", "KES", "USD", "ZAR", "XOF", "XAF", "UGX", "TZS", "RWF", "ZMW", "MWK", "EUR", "GBP",
] as const;
export type Currency = (typeof SUPPORTED_CURRENCIES)[number];

export const CURRENCY_LABELS: Record<Currency, string> = {
  NGN: "Nigerian Naira",
  GHS: "Ghanaian Cedi",
  KES: "Kenyan Shilling",
  USD: "US Dollar",
  ZAR: "South African Rand",
  XOF: "West African CFA Franc",
  XAF: "Central African CFA Franc",
  UGX: "Ugandan Shilling",
  TZS: "Tanzanian Shilling",
  RWF: "Rwandan Franc",
  ZMW: "Zambian Kwacha",
  MWK: "Malawian Kwacha",
  EUR: "Euro",
  GBP: "British Pound",
};

/** ISO-4217 currency exponents. Stored prices always use the currency's minor unit. */
const FRACTION_DIGITS: Partial<Record<Currency, number>> = { XOF: 0, XAF: 0, UGX: 0, TZS: 0, RWF: 0 };

export function currencyFractionDigits(currency: string): number {
  return FRACTION_DIGITS[currency as Currency] ?? 2;
}

export function minorUnitFactor(currency: string): number {
  return 10 ** currencyFractionDigits(currency);
}

export function fromMinorAmount(minor: number, currency: string): number {
  return minor / minorUnitFactor(currency);
}

export function toMinorAmount(amount: number, currency: string): number {
  return Math.round(amount * minorUnitFactor(currency));
}

/** Country (ISO-3166 alpha-2) to the currency we charge in. */
export const COUNTRY_CURRENCY: Record<string, Currency> = {
  NG: "NGN",
  GH: "GHS",
  KE: "KES",
  ZA: "ZAR",
  CI: "XOF",
  SN: "XOF",
  CM: "XAF",
  UG: "UGX",
  TZ: "TZS",
  RW: "RWF",
  ZM: "ZMW",
  MW: "MWK",
  GB: "GBP",
  AT: "EUR", BE: "EUR", CY: "EUR", DE: "EUR", EE: "EUR", ES: "EUR", FI: "EUR",
  FR: "EUR", GR: "EUR", HR: "EUR", IE: "EUR", IT: "EUR", LT: "EUR", LU: "EUR",
  LV: "EUR", MT: "EUR", NL: "EUR", PT: "EUR", SI: "EUR", SK: "EUR",
};

export function isCurrency(value: unknown): value is Currency {
  return typeof value === "string" && (SUPPORTED_CURRENCIES as readonly string[]).includes(value);
}

export const DEFAULT_CURRENCY: Currency = "NGN";

/**
 * Currency for a visitor's country. When the country is unknown or not one we
 * price locally, fall back to the store's configured default currency.
 */
export function currencyForCountry(
  country?: string | null,
  fallback: Currency = DEFAULT_CURRENCY,
): Currency {
  if (!country) return fallback;
  return COUNTRY_CURRENCY[country.toUpperCase()] ?? fallback;
}

export function formatMoney(minor: number, currency: string): string {
  const fractionDigits = currencyFractionDigits(currency);
  const amount = fromMinorAmount(minor, currency);
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(fractionDigits)}`;
  }
}

/**
 * Resolve the price for a currency: an explicit override wins, otherwise the
 * base price is converted with the configured rate table.
 */
export function resolvePriceMinor(args: {
  currency: Currency;
  basePriceMinor: number;
  baseCurrency: string;
  overrides: Partial<Record<string, number>>;
  fxRates: Partial<Record<string, number>>;
}): { priceMinor: number; isOverride: boolean } | null {
  const override = args.overrides[args.currency];
  if (typeof override === "number" && override > 0) {
    return { priceMinor: Math.round(override), isOverride: true };
  }
  if (args.currency === args.baseCurrency) {
    return args.basePriceMinor > 0 ? { priceMinor: Math.round(args.basePriceMinor), isOverride: false } : null;
  }
  const fromRate = args.fxRates[args.baseCurrency];
  const toRate = args.fxRates[args.currency];
  if (typeof fromRate !== "number" || fromRate <= 0 || typeof toRate !== "number" || toRate <= 0) return null;
  const baseAmount = fromMinorAmount(args.basePriceMinor, args.baseCurrency);
  return { priceMinor: Math.max(toMinorAmount((baseAmount / fromRate) * toRate, args.currency), 0), isOverride: false };
}
