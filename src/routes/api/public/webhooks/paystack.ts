import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";

export const Route = createFileRoute("/api/public/webhooks/paystack")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["PAYSTACK_SECRET_KEY"];
        if (!secret) return new Response("Not configured", { status: 503 });

        const body = await request.text();
        const signature = request.headers.get("x-paystack-signature") ?? "";
        const expected = createHmac("sha512", secret).update(body).digest("hex");
        const a = Buffer.from(signature);
        const b = Buffer.from(expected);
        if (a.length !== b.length || !timingSafeEqual(a, b)) {
          return new Response("Invalid signature", { status: 401 });
        }

        const payload = JSON.parse(body) as {
          event?: string;
          data?: { reference?: string; status?: string; id?: number };
        };
        if (payload.event !== "charge.success" || !payload.data?.reference) {
          return new Response("ok");
        }

        const { verifyPaystack, matchesVerifiedOrder } = await import("@/lib/gateways.server");
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: order } = await supabaseAdmin
          .from("orders")
          .select("reference, amount_minor, currency, gateway")
          .eq("reference", payload.data.reference)
          .maybeSingle();
        const verified = await verifyPaystack(payload.data.reference);
        if (!order || order.gateway !== "paystack" || !matchesVerifiedOrder(verified, order)) {
          return new Response("ok");
        }

        const { claimWebhookEvent, completeWebhookEvent, releaseWebhookEvent } = await import("@/lib/payment-operations.server");
        const eventId = payload.data.id ? String(payload.data.id) : payload.data.reference;
        const claimId = await claimWebhookEvent("paystack", `charge.success:${eventId}`);
        if (!claimId) return new Response("ok");

        const { markOrderPaid } = await import("@/lib/fulfillment.server");
        const origin = new URL(request.url).origin;
        try {
          await markOrderPaid({
            reference: payload.data.reference,
            gateway: "paystack",
            gatewayReference: verified.gatewayReference ?? (payload.data.id ? String(payload.data.id) : null),
            verifiedReference: verified.reference!,
            verifiedAmountMinor: verified.amountMinor!,
            verifiedCurrency: verified.currency!,
            baseUrl: origin,
          });
          await completeWebhookEvent(claimId);
        } catch (error) {
          await releaseWebhookEvent(claimId);
          console.error("Paystack webhook fulfilment failed", error);
        }
        return new Response("ok");
      },
    },
  },
});
