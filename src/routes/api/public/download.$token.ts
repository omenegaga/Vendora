import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/download/$token")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const token = params.token;
        if (!token || token.length < 20) return new Response("Invalid link", { status: 400 });

        const { consumePublicRateLimit } = await import("@/lib/payment-operations.server");
        const allowed = await consumePublicRateLimit({
          scope: "download-link",
          identifier: token,
          maxRequests: 30,
          windowSeconds: 5 * 60,
        });
        if (!allowed) return new Response("Too many download requests. Please try again shortly.", { status: 429 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: order } = await supabaseAdmin
          .from("orders")
          .select("id, status, download_expires_at, download_count, products(file_path, file_url, file_name)")
          .eq("download_token", token)
          .maybeSingle();

        if (!order || order.status !== "paid") {
          return new Response("This download link is not valid.", { status: 404 });
        }
        if (order.download_expires_at && new Date(order.download_expires_at) < new Date()) {
          return new Response("This download link has expired. Please request a new one.", {
            status: 410,
          });
        }

        const product = order.products;
        let target: string | null = null;

        if (product?.file_path) {
          const { data: signed } = await supabaseAdmin.storage
            .from("product-files")
            .createSignedUrl(product.file_path, 300, {
              download: product.file_name ?? true,
            });
          target = signed?.signedUrl ?? null;
        } else if (product?.file_url) {
          target = product.file_url;
        }

        if (!target) return new Response("This product has no file attached yet.", { status: 404 });

        await supabaseAdmin
          .from("orders")
          .update({ download_count: (order.download_count ?? 0) + 1 })
          .eq("id", order.id);

        return new Response(null, {
          status: 302,
          headers: { Location: target, "Cache-Control": "no-store" },
        });
      },
    },
  },
});
