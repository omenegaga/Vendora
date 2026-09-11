export const SUPPORTED_CURRENCIES = ["NGN", "GHS", "KES", "USD"] as const;
export type Currency = (typeof SUPPORTED_CURRENCIES)[number];

export const CURRENCY_LABELS: Record<Currency, string> = {
  NGN: "Nigerian Naira",
  GHS: "Ghanaian Cedi",
  KES: "Kenyan Shilling",
  USD: "US Dollar",
};

/** Country (ISO-3166 alpha-2) to the currency we charge in. */
export const COUNTRY_CURRENCY: Record<string, Currency> = {
  NG: "NGN",
  GH: "GHS",
  KE: "KES",
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
  const amount = minor / 100;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: currency === "NGN" || currency === "KES" ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
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
}): { priceMinor: number; isOverride: boolean } {
  const override = args.overrides[args.currency];
  if (typeof override === "number" && override > 0) {
    return { priceMinor: Math.round(override), isOverride: true };
  }
  const fromRate = args.fxRates[args.baseCurrency] ?? 1;
  const toRate = args.fxRates[args.currency] ?? 1;
  const converted = (args.basePriceMinor / fromRate) * toRate;
  const rounded = args.currency === "USD" ? Math.round(converted) : Math.round(converted / 100) * 100;
  return { priceMinor: Math.max(rounded, 0), isOverride: false };
}
