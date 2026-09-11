/** Minimal Meta Pixel loader. Browser-only. */

type Fbq = ((...args: unknown[]) => void) & { queue?: unknown[]; loaded?: boolean; push?: unknown };

declare global {
  interface Window {
    fbq?: Fbq;
    _fbq?: Fbq;
  }
}

let initialisedFor: string | null = null;

export function initPixel(pixelId?: string | null) {
  if (typeof window === "undefined" || !pixelId) return;
  if (initialisedFor === pixelId) return;

  if (!window.fbq) {
    const fbq: Fbq = function (...args: unknown[]) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const self = fbq as any;
      if (self.callMethod) self.callMethod(...args);
      else self.queue.push(args);
    } as Fbq;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (fbq as any).push = fbq;
    (fbq as Fbq).queue = [];
    (fbq as Fbq).loaded = true;
    window.fbq = fbq;
    window._fbq = fbq;

    const script = document.createElement("script");
    script.async = true;
    script.src = "https://connect.facebook.net/en_US/fbevents.js";
    document.head.appendChild(script);
  }

  window.fbq?.("init", pixelId);
  window.fbq?.("track", "PageView");
  initialisedFor = pixelId;
}

export function trackPixel(
  event: string,
  data?: Record<string, unknown>,
  eventId?: string,
  custom = false,
) {
  if (typeof window === "undefined" || !window.fbq) return;
  window.fbq(custom ? "trackCustom" : "track", event, data ?? {}, eventId ? { eventID: eventId } : undefined);
}

export function newEventId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `evt_${Math.random().toString(36).slice(2)}${Date.now()}`;
}
