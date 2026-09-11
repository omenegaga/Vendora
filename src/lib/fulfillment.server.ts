/** Server-only: marking orders paid, granting access, notifying Meta. */
import { randomBytes } from "crypto";

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendAccessEmail } from "./email.server";
import { sendPurchaseToCapi } from "./meta.server";

export type StoreSettings = {
  store_name: string;
  email_sender_name: string;
  support_email: string | null;
  download_expiry_hours: number;
  meta_pixel_id: string | null;
  meta_test_event_code: string | null;
  gateway_routing: Record<string, string[]>;
  fx_rates: Record<string, number>;
  default_currency: string;
};

export async function loadSettings(): Promise<StoreSettings> {
  const { data, error } = await supabaseAdmin.from("settings").select("*").eq("id", true).single();
  if (error || !data) throw new Error("Store settings are unavailable");
  return {
    store_name: data.store_name,
    email_sender_name: data.email_sender_name,
    support_email: data.support_email,
    download_expiry_hours: data.download_expiry_hours,
    meta_pixel_id: data.meta_pixel_id,
    meta_test_event_code: data.meta_test_event_code,
    gateway_routing: (data.gateway_routing ?? {}) as Record<string, string[]>,
    fx_rates: (data.fx_rates ?? {}) as Record<string, number>,
    default_currency: data.default_currency ?? "NGN",
  };
}

export function newReference(): string {
  return `ord_${randomBytes(9).toString("hex")}`;
}

export function newDownloadToken(): string {
  return randomBytes(24).toString("hex");
}

const META_CAPI_MAX_ATTEMPTS = 5;
const META_CAPI_RETRY_MINUTES = [1, 5, 30, 120, 720];

/**
 * Sends one Purchase event at most once per eligible order visit/webhook. A
 * stable event ID keeps Meta's browser/CAPI deduplication intact if a network
 * timeout leaves the delivery result ambiguous.
 */
export async function retryMetaCapiPurchase(args: {
  reference: string;
  baseUrl: string;
  clientIp?: string | null;
  userAgent?: string | null;
}): Promise<void> {
  const { data: order } = await supabaseAdmin
    .from("orders")
    .select("*, products(name, id)")
    .eq("reference", args.reference)
    .eq("status", "paid")
    .maybeSingle();
  if (!order || order.meta_capi_sent_at || order.meta_capi_attempts >= META_CAPI_MAX_ATTEMPTS) return;

  const nextRetryAt = order.meta_capi_next_retry_at
    ? new Date(order.meta_capi_next_retry_at).getTime()
    : 0;
  if (nextRetryAt > Date.now()) return;

  const settings = await loadSettings();
  const attribution = (order.attribution ?? {}) as Record<string, string | undefined>;
  const attempt = order.meta_capi_attempts + 1;
  const capi = await sendPurchaseToCapi({
    pixelId: settings.meta_pixel_id,
    testEventCode: settings.meta_test_event_code,
    eventId: order.meta_event_id ?? order.reference,
    eventSourceUrl: attribution["landing_page"] ?? `${args.baseUrl}/orders/${order.reference}`,
    email: order.email,
    phone: order.phone,
    name: order.name,
    country: order.country,
    value: order.amount_minor / 100,
    currency: order.currency,
    contentName: order.products?.name ?? "Your purchase",
    contentId: order.product_id,
    attribution,
    clientIp: args.clientIp,
    userAgent: args.userAgent,
  });

  const now = new Date();
  if (capi.sent) {
    await supabaseAdmin
      .from("orders")
      .update({
        meta_capi_sent_at: now.toISOString(),
        meta_capi_attempts: attempt,
        meta_capi_last_attempt_at: now.toISOString(),
        meta_capi_next_retry_at: null,
        meta_capi_last_error: null,
      })
      .eq("id", order.id);
    return;
  }

  const delayMinutes = META_CAPI_RETRY_MINUTES[attempt - 1] ?? META_CAPI_RETRY_MINUTES.at(-1)!;
  await supabaseAdmin
    .from("orders")
    .update({
      meta_capi_attempts: attempt,
      meta_capi_last_attempt_at: now.toISOString(),
      meta_capi_next_retry_at:
        attempt < META_CAPI_MAX_ATTEMPTS
          ? new Date(now.getTime() + delayMinutes * 60_000).toISOString()
          : null,
      meta_capi_last_error: capi.reason ?? "meta_request_failed",
    })
    .eq("id", order.id);
}

/** Runs from the protected scheduled-maintenance endpoint. Retry state lives in
 * orders, so deployment restarts cannot lose pending Meta Purchase events. */
export async function processDueMetaCapiRetries(baseUrl: string): Promise<number> {
  const { data: orders } = await supabaseAdmin
    .from("orders")
    .select("reference")
    .eq("status", "paid")
    .is("meta_capi_sent_at", null)
    .lt("meta_capi_attempts", META_CAPI_MAX_ATTEMPTS)
    .lte("meta_capi_next_retry_at", new Date().toISOString())
    .limit(100);
  for (const order of orders ?? []) {
    await retryMetaCapiPurchase({ reference: order.reference, baseUrl });
  }
  return orders?.length ?? 0;
}

/** Pending gateway sessions age into expired after 24 hours without changing
 * the normal pending → paid path for active payments. */
export async function expireStalePendingOrders(): Promise<number> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabaseAdmin
    .from("orders")
    .update({
      status: "expired",
      expired_at: new Date().toISOString(),
      payment_failure_reason: "payment_window_expired",
    })
    .eq("status", "pending")
    .lt("created_at", cutoff)
    .select("id");
  if (error) throw new Error("Could not expire stale orders");
  return data?.length ?? 0;
}

/**
 * Idempotent: a webhook and a browser return can both land here, only the
 * first one fulfils.
 */
export async function markOrderPaid(args: {
  reference: string;
  gateway: string;
  gatewayReference?: string | null;
  /** Values returned by the provider's server-side verification endpoint. */
  verifiedReference: string;
  verifiedAmountMinor: number;
  verifiedCurrency: string;
  baseUrl: string;
  clientIp?: string | null;
  userAgent?: string | null;
}): Promise<{ fulfilled: boolean; alreadyPaid: boolean }> {
  const { data: order, error } = await supabaseAdmin
    .from("orders")
    .select("*, products(name, id)")
    .eq("reference", args.reference)
    .maybeSingle();

  if (error || !order) throw new Error("Order not found");
  if (
    args.verifiedReference !== order.reference ||
    args.verifiedAmountMinor !== Number(order.amount_minor) ||
    args.verifiedCurrency !== order.currency ||
    (order.gateway && order.gateway !== args.gateway)
  ) {
    throw new Error("Verified payment does not match this order");
  }
  if (order.status === "paid") {
    await retryMetaCapiPurchase(args);
    return { fulfilled: true, alreadyPaid: true };
  }

  const settings = await loadSettings();
  const token = order.download_token ?? newDownloadToken();
  const expiresAt = new Date(
    Date.now() + Math.max(settings.download_expiry_hours, 1) * 3600_000,
  ).toISOString();

  // This conditional update is the payment state machine's atomic gate. Only
  // one concurrent webhook/browser verification can transition pending → paid.
  const { data: claimed, error: claimError } = await supabaseAdmin
    .from("orders")
    .update({
      status: "paid",
      gateway: args.gateway,
      gateway_reference: args.gatewayReference ?? order.gateway_reference,
      paid_at: new Date().toISOString(),
      fulfilled_at: new Date().toISOString(),
      download_token: token,
      download_expires_at: expiresAt,
    })
    .eq("id", order.id)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();
  if (claimError) throw new Error("Could not claim paid order");
  if (!claimed) return { fulfilled: true, alreadyPaid: true };

  const { data: customer } = await supabaseAdmin
    .from("customers")
    .upsert(
      {
        email: order.email,
        name: order.name,
        phone: order.phone,
        country: order.country,
      },
      { onConflict: "email" },
    )
    .select("id")
    .maybeSingle();

  await supabaseAdmin
    .from("orders")
    .update({ customer_id: customer?.id ?? order.customer_id })
    .eq("id", order.id);

  const productName = order.products?.name ?? "Your purchase";
  const downloadUrl = `${args.baseUrl}/api/public/download/${token}`;

  const email = await sendAccessEmail({
    to: order.email,
    buyerName: order.name,
    productName,
    downloadUrl,
    expiresAt,
    senderName: settings.email_sender_name,
    supportEmail: settings.support_email,
  });
  if (email.sent) {
    await supabaseAdmin
      .from("orders")
      .update({ access_email_sent_at: new Date().toISOString() })
      .eq("id", order.id);
  }

  await retryMetaCapiPurchase(args);

  return { fulfilled: true, alreadyPaid: false };
}
