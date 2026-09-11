import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "crypto";

export const Route = createFileRoute("/api/public/webhooks/flutterwave")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const hash = process.env["FLUTTERWAVE_SECRET_HASH"];
        if (!hash) return new Response("Not configured", { status: 503 });

        const provided = request.headers.get("verif-hash") ?? "";
        const a = Buffer.from(provided);
        const b = Buffer.from(hash);
        if (a.length !== b.length || !timingSafeEqual(a, b)) {
          return new Response("Invalid signature", { status: 401 });
        }

        const payload = (await request.json()) as {
          event?: string;
          data?: { tx_ref?: string; status?: string; id?: number };
        };
        const reference = payload.data?.tx_ref;
        if (payload.data?.status !== "successful" || !reference) return new Response("ok");

        const { verifyFlutterwave, matchesVerifiedOrder } = await import("@/lib/gateways.server");
        const verified = await verifyFlutterwave(reference);
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: order } = await supabaseAdmin
          .from("orders")
          .select("reference, amount_minor, currency, gateway")
          .eq("reference", reference)
          .maybeSingle();
        if (!order || order.gateway !== "flutterwave" || !matchesVerifiedOrder(verified, order)) {
          return new Response("ok");
        }

        const { claimWebhookEvent, completeWebhookEvent, releaseWebhookEvent } = await import("@/lib/payment-operations.server");
        const eventId = payload.data?.id ? String(payload.data.id) : reference;
        const claimId = await claimWebhookEvent("flutterwave", `payment:${eventId}`);
        if (!claimId) return new Response("ok");

        const { markOrderPaid } = await import("@/lib/fulfillment.server");
        try {
          await markOrderPaid({
            reference,
            gateway: "flutterwave",
            gatewayReference: verified.gatewayReference ?? null,
            verifiedReference: verified.reference!,
            verifiedAmountMinor: verified.amountMinor!,
            verifiedCurrency: verified.currency!,
            baseUrl: new URL(request.url).origin,
          });
          await completeWebhookEvent(claimId);
        } catch (error) {
          await releaseWebhookEvent(claimId);
          console.error("Flutterwave webhook fulfilment failed", error);
        }
        return new Response("ok");
      },
    },
  },
});
