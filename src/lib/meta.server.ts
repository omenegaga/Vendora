/** Server-only Meta Conversions API sender. */
import { createHash } from "crypto";

type Attribution = Record<string, string | undefined>;

function hash(value?: string | null): string | undefined {
  if (!value) return undefined;
  return createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}

export async function sendPurchaseToCapi(args: {
  pixelId?: string | null | undefined;
  testEventCode?: string | null | undefined;
  eventId: string;
  eventSourceUrl?: string | null | undefined;
  email: string;
  phone?: string | null | undefined;
  name?: string | null | undefined;
  country?: string | null | undefined;
  value: number;
  currency: string;
  contentName?: string | null | undefined;
  contentId?: string | null | undefined;
  attribution: Attribution;
  clientIp?: string | null | undefined;
  userAgent?: string | null | undefined;
}): Promise<{ sent: boolean; reason?: string }> {
  const { getMetaCapiToken } = await import("./meta-credentials.server");
  const token = await getMetaCapiToken();
  if (!token || !args.pixelId) return { sent: false, reason: "meta_not_configured" };

  const [first, ...rest] = (args.name ?? "").trim().split(/\s+/);

  const userData: Record<string, unknown> = {
    em: [hash(args.email)].filter(Boolean),
    ph: args.phone ? [hash(args.phone.replace(/[^\d]/g, ""))] : undefined,
    fn: first ? [hash(first)] : undefined,
    ln: rest.length ? [hash(rest.join(" "))] : undefined,
    country: args.country ? [hash(args.country)] : undefined,
    fbp: args.attribution["fbp"],
    fbc: args.attribution["fbc"],
    client_ip_address: args.clientIp ?? undefined,
    client_user_agent: args.userAgent ?? undefined,
  };

  const body: Record<string, unknown> = {
    data: [
      {
        event_name: "Purchase",
        event_time: Math.floor(Date.now() / 1000),
        event_id: args.eventId,
        event_source_url: args.eventSourceUrl ?? undefined,
        action_source: "website",
        user_data: userData,
        custom_data: {
          value: args.value,
          currency: args.currency,
          content_name: args.contentName ?? undefined,
          content_ids: args.contentId ? [args.contentId] : undefined,
          content_type: "product",
          utm_source: args.attribution["utm_source"],
          utm_medium: args.attribution["utm_medium"],
          utm_campaign: args.attribution["utm_campaign"],
          utm_content: args.attribution["utm_content"],
          utm_term: args.attribution["utm_term"],
        },
      },
    ],
  };
  if (args.testEventCode) body["test_event_code"] = args.testEventCode;

  try {
    const response = await fetch(
      `https://graph.facebook.com/v20.0/${args.pixelId}/events?access_token=${encodeURIComponent(token)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    if (!response.ok) {
      console.error("Meta CAPI rejected the purchase event", await response.text());
      return { sent: false, reason: "meta_rejected" };
    }
    return { sent: true };
  } catch (error) {
    console.error("Meta CAPI request failed", error);
    return { sent: false, reason: "meta_request_failed" };
  }
}
