import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";

import {
  isCurrency,
  resolvePriceMinor,
  currencyForCountry,
  DEFAULT_CURRENCY,
  type Currency,
} from "./money";

const attributionSchema = z.record(z.string(), z.string().max(500)).default({});

/** Keeps the local UI usable before a Lovable/Supabase server key is added. */
function isLocalPreviewWithoutDatabase() {
  return process.env["NODE_ENV"] !== "production" && !process.env["SUPABASE_SERVICE_ROLE_KEY"];
}

const DEMO_PRODUCT = {
  id: "demo-product",
  slug: "sample-ebook",
  name: "Sample Digital Product",
  tagline: "Demo product — add your first product from Admin",
  description:
    "This local preview uses sample data until you connect your Supabase service key. Your real products will appear automatically after it is configured.",
  coverImageUrl: null,
  currency: "USD" as Currency,
  priceMinor: 1900,
  country: null,
  availableCurrencies: ["NGN", "GHS", "KES", "USD"] as Currency[],
  storeName: "Vendora — preview",
  metaPixelId: null,
};

function requestOrigin(): string {
  const request = getRequest();
  const url = new URL(request.url);
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const host = forwardedHost ?? url.host;
  const proto = forwardedProto ?? url.protocol.replace(":", "");
  return `${proto}://${host}`;
}

function detectCountry(): string | null {
  const request = getRequest();
  return (
    request.headers.get("cf-ipcountry") ??
    request.headers.get("x-vercel-ip-country") ??
    request.headers.get("x-country") ??
    null
  );
}

export type CheckoutProduct = {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  description: string | null;
  coverImageUrl: string | null;
  currency: Currency;
  priceMinor: number;
  country: string | null;
  availableCurrencies: Currency[];
  storeName: string;
  metaPixelId: string | null;
};

/** Public: product + the price for the visitor's country. */
export const getCheckoutProduct = createServerFn({ method: "GET" })
  .inputValidator((input: { slug: string; currency?: string }) =>
    z.object({ slug: z.string().min(1), currency: z.string().optional() }).parse(input),
  )
  .handler(async ({ data }): Promise<CheckoutProduct | null> => {
    if (isLocalPreviewWithoutDatabase()) {
      if (data.slug !== DEMO_PRODUCT.slug) return null;
      const currency = isCurrency(data.currency) ? data.currency : DEMO_PRODUCT.currency;
      const priceMinorByCurrency: Partial<Record<Currency, number>> = {
        USD: 1900,
        NGN: 2_500_000,
        GHS: 25_000,
        KES: 250_000,
      };
      const selected = priceMinorByCurrency[currency] ? currency : DEMO_PRODUCT.currency;
      return { ...DEMO_PRODUCT, currency: selected, priceMinor: priceMinorByCurrency[selected]!, availableCurrencies: Object.keys(priceMinorByCurrency) as Currency[] };
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { loadSettings } = await import("./fulfillment.server");

    const { data: product } = await supabaseAdmin
      .from("products")
      .select("*, product_prices(currency, price_minor)")
      .eq("slug", data.slug)
      .eq("is_active", true)
      .maybeSingle();
    if (!product) return null;

    const settings = await loadSettings();
    const country = detectCountry();
    const storeDefault = isCurrency(settings.default_currency)
      ? settings.default_currency
      : DEFAULT_CURRENCY;
    const overrides: Record<string, number> = {};
    for (const row of product.product_prices ?? []) overrides[row.currency] = Number(row.price_minor);
    const priced = SUPPORTED_CURRENCIES.flatMap((currency) => {
      const resolved = resolvePriceMinor({ currency, basePriceMinor: Number(product.base_price_minor), baseCurrency: product.base_currency, overrides, fxRates: settings.fx_rates });
      return resolved ? [{ currency, priceMinor: resolved.priceMinor }] : [];
    });
    if (!priced.length) return null;
    const requested = isCurrency(data.currency) ? data.currency : currencyForCountry(country, storeDefault);
    const chosen = priced.find(({ currency }) => currency === requested)
      ?? priced.find(({ currency }) => currency === storeDefault)
      ?? priced[0];

    return {
      id: product.id,
      slug: product.slug,
      name: product.name,
      tagline: product.tagline,
      description: product.description,
      coverImageUrl: product.cover_image_url,
      currency: chosen.currency,
      priceMinor: chosen.priceMinor,
      country,
      availableCurrencies: priced.map(({ currency }) => currency),
      storeName: settings.store_name,
      metaPixelId: settings.meta_pixel_id,
    };
  });

/** Public: active products for the storefront. */
export const listStoreProducts = createServerFn({ method: "GET" }).handler(async () => {
  if (isLocalPreviewWithoutDatabase()) {
    return {
      storeName: DEMO_PRODUCT.storeName,
      currency: DEMO_PRODUCT.currency,
      country: null,
      metaPixelId: null,
      products: [
        {
          id: DEMO_PRODUCT.id,
          slug: DEMO_PRODUCT.slug,
          name: DEMO_PRODUCT.name,
          tagline: DEMO_PRODUCT.tagline,
          coverImageUrl: DEMO_PRODUCT.coverImageUrl,
          currency: DEMO_PRODUCT.currency,
          priceMinor: DEMO_PRODUCT.priceMinor,
        },
      ],
    };
  }
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { loadSettings } = await import("./fulfillment.server");

  const [{ data: products }, settings] = await Promise.all([
    supabaseAdmin
      .from("products")
      .select("id, slug, name, tagline, cover_image_url, base_currency, base_price_minor, product_prices(currency, price_minor)")
      .eq("is_active", true)
      .order("created_at", { ascending: false }),
    loadSettings(),
  ]);

  const country = detectCountry();
  const currency = currencyForCountry(
    country,
    isCurrency(settings.default_currency) ? settings.default_currency : DEFAULT_CURRENCY,
  );

  return {
    storeName: settings.store_name,
    currency,
    country,
    metaPixelId: settings.meta_pixel_id,
    products: (products ?? []).map((product) => {
      const overrides: Record<string, number> = {};
      for (const row of product.product_prices ?? []) overrides[row.currency] = Number(row.price_minor);
      const available = SUPPORTED_CURRENCIES.flatMap((candidate) => {
        const resolved = resolvePriceMinor({ currency: candidate, basePriceMinor: Number(product.base_price_minor), baseCurrency: product.base_currency, overrides, fxRates: settings.fx_rates });
        return resolved ? [{ currency: candidate, priceMinor: resolved.priceMinor }] : [];
      });
      const chosen = available.find(({ currency: candidate }) => candidate === currency)
        ?? available.find(({ currency: candidate }) => candidate === settings.default_currency)
        ?? available[0];
      if (!chosen) return null;
      return {
        id: product.id,
        slug: product.slug,
        name: product.name,
        tagline: product.tagline,
        coverImageUrl: product.cover_image_url,
        currency: chosen.currency,
        priceMinor: chosen.priceMinor,
      };
    }).filter((product): product is NonNullable<typeof product> => product !== null),
  };
});

const startCheckoutSchema = z.object({
  slug: z.string().min(1),
  currency: z.string().min(3).max(3),
  email: z.string().email().max(200),
  name: z.string().min(1).max(120),
  eventId: z.string().min(1).max(80),
  attribution: attributionSchema,
});

export type StartCheckoutResult = {
  reference: string;
  checkoutUrl: string | null;
  gateway: string | null;
  testMode: boolean;
  amountMinor: number;
  currency: string;
};

/** Public: create the order and hand back a gateway checkout link. */
export const startCheckout = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => startCheckoutSchema.parse(input))
  .handler(async ({ data }): Promise<StartCheckoutResult> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { loadSettings, newReference } = await import("./fulfillment.server");
    const gateways = await import("./gateways.server");

    if (!isCurrency(data.currency)) throw new Error("Unsupported currency");

    const { data: product } = await supabaseAdmin
      .from("products")
      .select("*, product_prices(currency, price_minor)")
      .eq("slug", data.slug)
      .eq("is_active", true)
      .maybeSingle();
    if (!product) throw new Error("This product is no longer available");

    const settings = await loadSettings();
    const overrides: Record<string, number> = {};
    for (const row of product.product_prices ?? []) overrides[row.currency] = Number(row.price_minor);
    const resolvedPrice = resolvePriceMinor({
      currency: data.currency,
      basePriceMinor: Number(product.base_price_minor),
      baseCurrency: product.base_currency,
      overrides,
      fxRates: settings.fx_rates,
    });
    if (!resolvedPrice || resolvedPrice.priceMinor <= 0) throw new Error("This product has no configured price for that currency");
    const priceMinor = resolvedPrice.priceMinor;

    const origin = requestOrigin();
    const country = detectCountry();
    const reference = newReference();

    const { error: insertError } = await supabaseAdmin.from("orders").insert({
      reference,
      product_id: product.id,
      email: data.email,
      name: data.name,
      phone: null,
      country,
      currency: data.currency,
      amount_minor: priceMinor,
      status: "pending",
      attribution: data.attribution,
      meta_event_id: data.eventId,
    });
    if (insertError) throw new Error("Could not start this order");

    const callbackUrl = `${origin}/orders/${reference}`;
    const candidates = gateways.routeGateways(data.currency, settings.gateway_routing);
    const attempted: string[] = [];

    for (const gateway of candidates) {
      attempted.push(gateway);
      try {
        const result =
          gateway === "paystack"
            ? await gateways.initPaystack({
                email: data.email,
                amountMinor: priceMinor,
                currency: data.currency,
                reference,
                callbackUrl,
                metadata: { product: product.name, reference, ...data.attribution },
              })
            : await gateways.initFlutterwave({
                email: data.email,
                name: data.name,
                amountMinor: priceMinor,
                currency: data.currency,
                reference,
                callbackUrl,
                metadata: { product: product.name, reference, ...data.attribution },
                title: settings.store_name,
              });

        await supabaseAdmin
          .from("orders")
          .update({
            gateway,
            gateway_reference: result.gatewayReference,
            checkout_url: result.checkoutUrl,
            gateway_attempted: attempted,
          })
          .eq("reference", reference);

        return {
          reference,
          checkoutUrl: result.checkoutUrl,
          gateway,
          testMode: false,
          amountMinor: priceMinor,
          currency: data.currency,
        };
      } catch (error) {
        console.error(`${gateway} could not start order ${reference}`, error);
      }
    }

    await supabaseAdmin
      .from("orders")
      .update({ gateway_attempted: attempted })
      .eq("reference", reference);

    if (candidates.length === 0) {
      // No live gateway keys yet: the order is real, payment is simulated.
      return {
        reference,
        checkoutUrl: null,
        gateway: null,
        testMode: true,
        amountMinor: priceMinor,
        currency: data.currency,
      };
    }

    throw new Error("No payment provider could start this payment. Please try again.");
  });

export type OrderView = {
  reference: string;
  status: string;
  email: string;
  name: string | null;
  currency: string;
  amountMinor: number;
  gateway: string | null;
  productName: string | null;
  checkoutUrl: string | null;
  downloadUrl: string | null;
  downloadExpiresAt: string | null;
  accessEmailSent: boolean;
  metaPixelId: string | null;
  metaEventId: string | null;
  testMode: boolean;
};

async function buildOrderView(reference: string): Promise<OrderView | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { loadSettings } = await import("./fulfillment.server");
  const { anyGatewayConfigured } = await import("./gateways.server");

  const { data: order } = await supabaseAdmin
    .from("orders")
    .select("*, products(name)")
    .eq("reference", reference)
    .maybeSingle();
  if (!order) return null;

  const settings = await loadSettings();
  return {
    reference: order.reference,
    status: order.status,
    email: order.email,
    name: order.name,
    currency: order.currency,
    amountMinor: Number(order.amount_minor),
    gateway: order.gateway,
    productName: order.products?.name ?? null,
    checkoutUrl: order.status === "pending" ? order.checkout_url : null,
    downloadUrl:
      order.status === "paid" && order.download_token
        ? `${requestOrigin()}/api/public/download/${order.download_token}`
        : null,
    downloadExpiresAt: order.download_expires_at,
    accessEmailSent: !!order.access_email_sent_at,
    metaPixelId: settings.meta_pixel_id,
    metaEventId: order.meta_event_id,
    testMode: !anyGatewayConfigured(),
  };
}

/** Public: verify with the gateway, fulfil if paid, return the buyer's view. */
export const verifyOrder = createServerFn({ method: "POST" })
  .inputValidator((input: { reference: string }) =>
    z.object({ reference: z.string().min(6).max(80) }).parse(input),
  )
  .handler(async ({ data }): Promise<OrderView | null> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { markOrderPaid, retryMetaCapiPurchase } = await import("./fulfillment.server");
    const { verifyWithGateway, isGatewayConfigured, matchesVerifiedOrder } = await import("./gateways.server");
    const { recordPaymentTerminalState } = await import("./payment-operations.server");

    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("reference, status, gateway, gateway_attempted, currency, amount_minor")
      .eq("reference", data.reference)
      .maybeSingle();
    if (!order) return null;

    if (order.status !== "paid") {
      const request = getRequest();
      const candidates = [order.gateway, ...(order.gateway_attempted ?? [])].filter(
        (g): g is "paystack" | "flutterwave" => g === "paystack" || g === "flutterwave",
      );
      for (const gateway of [...new Set(candidates)]) {
        if (!isGatewayConfigured(gateway)) continue;
        const result = await verifyWithGateway(gateway, order.reference);
        if (matchesVerifiedOrder(result, order)) {
          await markOrderPaid({
            reference: order.reference,
            gateway,
            gatewayReference: result.gatewayReference ?? null,
            verifiedReference: result.reference!,
            verifiedAmountMinor: result.amountMinor!,
            verifiedCurrency: result.currency!,
            baseUrl: requestOrigin(),
            clientIp: request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for"),
            userAgent: request.headers.get("user-agent"),
          });
          break;
        }
        const status = result.paymentStatus?.toLowerCase();
        if (status === "failed") {
          await recordPaymentTerminalState({ reference: order.reference, status: "failed", reason: `${gateway}_failed` });
          break;
        }
        if (status === "cancelled" || status === "canceled") {
          await recordPaymentTerminalState({ reference: order.reference, status: "cancelled", reason: `${gateway}_cancelled` });
          break;
        }
        if (status === "abandoned") {
          await recordPaymentTerminalState({ reference: order.reference, status: "abandoned", reason: `${gateway}_abandoned` });
          break;
        }
      }
    }

    // A buyer returning to the confirmation page provides an additional safe
    // retry opportunity after a transient CAPI failure. The helper enforces
    // both the backoff window and a five-attempt maximum.
    await retryMetaCapiPurchase({
      reference: order.reference,
      baseUrl: requestOrigin(),
      clientIp: getRequest().headers.get("cf-connecting-ip") ?? getRequest().headers.get("x-forwarded-for"),
      userAgent: getRequest().headers.get("user-agent"),
    });

    return buildOrderView(data.reference);
  });

export const getOrder = createServerFn({ method: "GET" })
  .inputValidator((input: { reference: string }) =>
    z.object({ reference: z.string().min(6).max(80) }).parse(input),
  )
  .handler(async ({ data }) => buildOrderView(data.reference));

/** Test mode only: available while no live gateway keys exist. */
export const confirmTestOrder = createServerFn({ method: "POST" })
  .inputValidator((input: { reference: string }) =>
    z.object({ reference: z.string().min(6).max(80) }).parse(input),
  )
  .handler(async ({ data }): Promise<OrderView | null> => {
    const { anyGatewayConfigured } = await import("./gateways.server");
    if (anyGatewayConfigured()) throw new Error("Test payments are disabled once a gateway is live");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("reference, amount_minor, currency")
      .eq("reference", data.reference)
      .maybeSingle();
    if (!order) return null;

    const { markOrderPaid } = await import("./fulfillment.server");
    await markOrderPaid({
      reference: data.reference,
      gateway: "test",
      gatewayReference: `test_${data.reference}`,
      verifiedReference: order.reference,
      verifiedAmountMinor: Number(order.amount_minor),
      verifiedCurrency: order.currency,
      baseUrl: requestOrigin(),
    });
    return buildOrderView(data.reference);
  });

export const resendAccessEmail = createServerFn({ method: "POST" })
  .inputValidator((input: { reference: string }) =>
    z.object({ reference: z.string().min(6).max(80) }).parse(input),
  )
  .handler(async ({ data }): Promise<{ sent: boolean; reason?: string }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { loadSettings } = await import("./fulfillment.server");
    const { sendAccessEmail: send } = await import("./email.server");
    const { consumePublicRateLimit } = await import("./payment-operations.server");

    const allowed = await consumePublicRateLimit({
      scope: "resend-access-email",
      identifier: data.reference,
      maxRequests: 3,
      windowSeconds: 60 * 60,
    });
    if (!allowed) return { sent: false, reason: "rate_limited" };

    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("*, products(name)")
      .eq("reference", data.reference)
      .eq("status", "paid")
      .maybeSingle();
    if (!order || !order.download_token) return { sent: false, reason: "order_not_ready" };

    const settings = await loadSettings();
    const result = await send({
      to: order.email,
      buyerName: order.name,
      productName: order.products?.name ?? "Your purchase",
      downloadUrl: `${requestOrigin()}/api/public/download/${order.download_token}`,
      expiresAt: order.download_expires_at ?? new Date().toISOString(),
      senderName: settings.email_sender_name,
      supportEmail: settings.support_email,
    });
    if (result.sent) {
      await supabaseAdmin
        .from("orders")
        .update({ access_email_sent_at: new Date().toISOString() })
        .eq("id", order.id);
    }
    return result;
  });
