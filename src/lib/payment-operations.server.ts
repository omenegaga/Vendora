/** Server-only helpers for provider event claims, public limits, and payment states. */
import { createHash } from "crypto";

import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type PaymentTerminalStatus = "failed" | "cancelled" | "expired" | "abandoned";

function digest(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export async function claimWebhookEvent(provider: "paystack" | "flutterwave", eventKey: string) {
  const { data, error } = await supabaseAdmin
    .from("payment_webhook_events")
    .insert({ provider, event_key: eventKey })
    .select("id")
    .maybeSingle();
  if (error?.code === "23505") return null;
  if (error || !data) throw new Error("Could not claim payment webhook event");
  return data.id;
}

export async function releaseWebhookEvent(id: string) {
  await supabaseAdmin.from("payment_webhook_events").delete().eq("id", id);
}

export async function completeWebhookEvent(id: string) {
  await supabaseAdmin
    .from("payment_webhook_events")
    .update({ processed_at: new Date().toISOString() })
    .eq("id", id);
}

export async function consumePublicRateLimit(args: {
  scope: string;
  identifier: string;
  maxRequests: number;
  windowSeconds: number;
}): Promise<boolean> {
  const { data, error } = await supabaseAdmin.rpc("consume_public_rate_limit", {
    p_key_hash: digest(`${args.scope}:${args.identifier}`),
    p_max_requests: args.maxRequests,
    p_window_seconds: args.windowSeconds,
  });
  if (error) throw new Error("Could not enforce public rate limit");
  return data === true;
}

export async function recordPaymentTerminalState(args: {
  reference: string;
  status: PaymentTerminalStatus;
  reason?: string;
}) {
  const timestampColumn: Record<PaymentTerminalStatus, string> = {
    failed: "failed_at",
    cancelled: "cancelled_at",
    expired: "expired_at",
    abandoned: "abandoned_at",
  } as never;
  const { data, error } = await supabaseAdmin
    .from("orders")
    .update({
      status: args.status,
      payment_failure_reason: args.reason ?? null,
      [timestampColumn[args.status]]: new Date().toISOString(),
    })
    .eq("reference", args.reference)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();
  if (error) throw new Error("Could not update payment status");
  return Boolean(data);
}
