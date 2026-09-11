/** Browser-side capture of Meta + UTM attribution, kept as first-touch. */

export type Attribution = {
  fbclid?: string | undefined;
  fbp?: string | undefined;
  fbc?: string | undefined;
  utm_source?: string | undefined;
  utm_medium?: string | undefined;
  utm_campaign?: string | undefined;
  utm_term?: string | undefined;
  utm_content?: string | undefined;
  referrer?: string | undefined;
  landing_page?: string | undefined;
  captured_at?: string | undefined;
};

const STORAGE_KEY = "checkout_attribution_v1";
const FBP_TRANSPORT_COOKIE = "vendora_fbp";
const FBC_TRANSPORT_COOKIE = "vendora_fbc";

const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"] as const;

export function readCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const match = document.cookie.split("; ").find((row) => row.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : undefined;
}

function writeCookie(name: string, value: string, days = 90) {
  if (typeof document === "undefined") return;
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
}

/** Values forwarded by Checkout Charm's embed helper from another domain. */
function transportValue(params: URLSearchParams, name: "fbp" | "fbc") {
  return params.get(`cc_${name}`) ?? params.get(name) ?? undefined;
}

/**
 * Meta's _fbc cookie format: fb.1.<timestamp>.<fbclid>. If the Pixel has not
 * written it yet (blocked, slow, or not configured) we write it ourselves so
 * the click never loses its attribution.
 */
function ensureFbc(fbclid?: string): string | undefined {
  const existing = readCookie("_fbc") ?? readCookie(FBC_TRANSPORT_COOKIE);
  if (existing) return existing;
  if (!fbclid) return undefined;
  const value = `fb.1.${Date.now()}.${fbclid}`;
  writeCookie("_fbc", value);
  writeCookie(FBC_TRANSPORT_COOKIE, value);
  return value;
}

export function captureAttribution(): Attribution {
  if (typeof window === "undefined") return {};

  const params = new URLSearchParams(window.location.search);
  const fresh: Attribution = {};

  const fbclid = params.get("fbclid") ?? undefined;
  if (fbclid) fresh.fbclid = fbclid;
  const fbp = transportValue(params, "fbp") ?? readCookie(FBP_TRANSPORT_COOKIE);
  const fbc = transportValue(params, "fbc") ?? readCookie(FBC_TRANSPORT_COOKIE);
  if (fbp) fresh.fbp = fbp;
  if (fbc) fresh.fbc = fbc;
  const originatingLandingPage = params.get("cc_landing_page") ?? undefined;
  const originatingReferrer = params.get("cc_referrer") ?? undefined;
  const originatingCapturedAt = params.get("cc_captured_at") ?? undefined;
  if (originatingLandingPage) fresh.landing_page = originatingLandingPage;
  if (originatingReferrer) fresh.referrer = originatingReferrer;
  if (originatingCapturedAt) fresh.captured_at = originatingCapturedAt;
  for (const key of UTM_KEYS) {
    const value = params.get(key);
    if (value) fresh[key] = value;
  }

  let stored: Attribution = {};
  try {
    stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}") as Attribution;
  } catch {
    stored = {};
  }

  const hasFresh = Boolean(
    fbclid || UTM_KEYS.some((key) => fresh[key]) || originatingLandingPage,
  );
  // First-touch wins. A later campaign link must never replace the ad click
  // that originally brought this buyer to the sales page.
  const merged: Attribution = hasFresh
    ? {
        ...fresh,
        ...stored,
        referrer: stored.referrer ?? originatingReferrer ?? document.referrer ?? undefined,
        landing_page: stored.landing_page ?? originatingLandingPage ?? window.location.href,
        captured_at: stored.captured_at ?? originatingCapturedAt ?? new Date().toISOString(),
      }
    : { ...stored };

  if (!merged.referrer && document.referrer) merged.referrer = document.referrer;
  if (!merged.landing_page) merged.landing_page = window.location.href;
  if (!merged.captured_at) merged.captured_at = new Date().toISOString();

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  } catch {
    /* storage blocked — cookies below still carry the click */
  }

  // Preserve the first browser identifiers too. A forwarded value is vital in
  // an iframe, where the checkout cannot reliably read the sales page cookies.
  const resolvedFbp = merged.fbp ?? readCookie("_fbp") ?? readCookie(FBP_TRANSPORT_COOKIE);
  const resolvedFbc = merged.fbc ?? readCookie("_fbc") ?? ensureFbc(merged.fbclid);
  if (resolvedFbp) writeCookie(FBP_TRANSPORT_COOKIE, resolvedFbp);
  if (resolvedFbc) writeCookie(FBC_TRANSPORT_COOKIE, resolvedFbc);
  return {
    ...merged,
    ...(resolvedFbp ? { fbp: resolvedFbp } : {}),
    ...(resolvedFbc ? { fbc: resolvedFbc } : {}),
  };
}
