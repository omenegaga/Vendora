/** Server-only Paystack + Flutterwave clients. */

export type GatewayName = "paystack" | "flutterwave";

export type InitResult = { checkoutUrl: string; gatewayReference: string };

export type VerifyResult = {
  paid: boolean;
  reference?: string | undefined;
  paymentStatus?: string | undefined;
  currency?: string | undefined;
  amountMinor?: number | undefined;
  gatewayReference?: string | undefined;
  raw?: unknown;
};

export function paystackKey(): string | undefined {
  const key = process.env["PAYSTACK_SECRET_KEY"];
  return key && key.trim().length > 0 ? key.trim() : undefined;
}

export function flutterwaveKey(): string | undefined {
  const key = process.env["FLUTTERWAVE_SECRET_KEY"];
  return key && key.trim().length > 0 ? key.trim() : undefined;
}

export function isGatewayConfigured(gateway: GatewayName): boolean {
  return gateway === "paystack" ? !!paystackKey() : !!flutterwaveKey();
}

export function anyGatewayConfigured(): boolean {
  return !!paystackKey() || !!flutterwaveKey();
}

/** Paystack charges in minor units and supports NGN, GHS, KES, USD, ZAR. */
export async function initPaystack(args: {
  email: string;
  amountMinor: number;
  currency: string;
  reference: string;
  callbackUrl: string;
  metadata: Record<string, unknown>;
}): Promise<InitResult> {
  const key = paystackKey();
  if (!key) throw new Error("Paystack is not configured");

  const response = await fetch("https://api.paystack.co/transaction/initialize", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      email: args.email,
      amount: args.amountMinor,
      currency: args.currency,
      reference: args.reference,
      callback_url: args.callbackUrl,
      metadata: args.metadata,
    }),
  });

  const payload = (await response.json()) as {
    status?: boolean;
    message?: string;
    data?: { authorization_url?: string; reference?: string };
  };
  if (!response.ok || !payload.status || !payload.data?.authorization_url) {
    throw new Error(payload.message ?? "Paystack could not start this payment");
  }
  return {
    checkoutUrl: payload.data.authorization_url,
    gatewayReference: payload.data.reference ?? args.reference,
  };
}

export async function verifyPaystack(reference: string): Promise<VerifyResult> {
  const key = paystackKey();
  if (!key) return { paid: false };

  const response = await fetch(
    `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
    { headers: { Authorization: `Bearer ${key}` } },
  );
  const payload = (await response.json()) as {
    status?: boolean;
    data?: { status?: string; currency?: string; amount?: number; reference?: string };
  };
  const data = payload.data;
  return {
    paid: payload.status === true && data?.status === "success",
    reference: data?.reference,
    paymentStatus: data?.status,
    currency: data?.currency,
    amountMinor: typeof data?.amount === "number" ? data.amount : undefined,
    gatewayReference: data?.reference ?? reference,
    raw: payload,
  };
}

/** Flutterwave charges in major units. */
export async function initFlutterwave(args: {
  email: string;
  name?: string | null;
  phone?: string | null;
  amountMinor: number;
  currency: string;
  reference: string;
  callbackUrl: string;
  metadata: Record<string, unknown>;
  title: string;
}): Promise<InitResult> {
  const key = flutterwaveKey();
  if (!key) throw new Error("Flutterwave is not configured");

  const response = await fetch("https://api.flutterwave.com/v3/payments", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      tx_ref: args.reference,
      amount: (args.amountMinor / 100).toFixed(2),
      currency: args.currency,
      redirect_url: args.callbackUrl,
      customer: { email: args.email, name: args.name ?? undefined, phonenumber: args.phone ?? undefined },
      customizations: { title: args.title },
      meta: args.metadata,
    }),
  });

  const payload = (await response.json()) as {
    status?: string;
    message?: string;
    data?: { link?: string };
  };
  if (!response.ok || payload.status !== "success" || !payload.data?.link) {
    throw new Error(payload.message ?? "Flutterwave could not start this payment");
  }
  return { checkoutUrl: payload.data.link, gatewayReference: args.reference };
}

export async function verifyFlutterwave(reference: string): Promise<VerifyResult> {
  const key = flutterwaveKey();
  if (!key) return { paid: false };

  const response = await fetch(
    `https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${encodeURIComponent(reference)}`,
    { headers: { Authorization: `Bearer ${key}` } },
  );
  const payload = (await response.json()) as {
    status?: string;
    data?: { status?: string; currency?: string; amount?: number; id?: number; tx_ref?: string };
  };
  const data = payload.data;
  return {
    paid: payload.status === "success" && data?.status === "successful",
    reference: data?.tx_ref,
    paymentStatus: data?.status,
    currency: data?.currency,
    amountMinor: typeof data?.amount === "number" ? Math.round(data.amount * 100) : undefined,
    gatewayReference: data?.id ? String(data.id) : reference,
    raw: payload,
  };
}

export async function verifyWithGateway(
  gateway: GatewayName,
  reference: string,
): Promise<VerifyResult> {
  return gateway === "paystack" ? verifyPaystack(reference) : verifyFlutterwave(reference);
}

/** Every provider response must exactly match the Vendora order before fulfilment. */
export function matchesVerifiedOrder(
  result: VerifyResult,
  order: { reference: string; amount_minor: number; currency: string },
): boolean {
  return (
    result.paid === true &&
    result.reference === order.reference &&
    result.amountMinor === Number(order.amount_minor) &&
    result.currency === order.currency
  );
}

/**
 * Smart routing: the configured order for the currency, filtered to gateways
 * that actually have keys. First one that initialises wins; the rest are
 * fallbacks.
 */
export function routeGateways(
  currency: string,
  routing: Record<string, string[] | undefined>,
): GatewayName[] {
  const preferred = (routing[currency] ?? ["paystack", "flutterwave"]).filter(
    (g): g is GatewayName => g === "paystack" || g === "flutterwave",
  );
  const all: GatewayName[] = ["paystack", "flutterwave"];
  const ordered = [...preferred, ...all.filter((g) => !preferred.includes(g))];
  return ordered.filter((g) => isGatewayConfigured(g));
}
