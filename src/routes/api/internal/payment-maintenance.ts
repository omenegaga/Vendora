import { createFileRoute } from "@tanstack/react-router";

function isAuthorised(request: Request) {
  const secret = process.env["VENDORA_CRON_SECRET"];
  const provided = request.headers.get("authorization");
  return Boolean(secret && provided === `Bearer ${secret}`);
}

/**
 * Invoke every five minutes from your deployment scheduler. It is deliberately
 * not public: this processes durable CAPI retry state and expires stale orders.
 */
export const Route = createFileRoute("/api/internal/payment-maintenance")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!isAuthorised(request)) return new Response("Unauthorized", { status: 401 });
        const { processDueMetaCapiRetries, expireStalePendingOrders } = await import("@/lib/fulfillment.server");
        const baseUrl = new URL(request.url).origin;
        const [capiRetries, expiredOrders] = await Promise.all([
          processDueMetaCapiRetries(baseUrl),
          expireStalePendingOrders(),
        ]);
        return Response.json({ capiRetries, expiredOrders });
      },
    },
  },
});
