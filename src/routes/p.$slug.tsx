import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, ChevronDown, Download, Loader2, Lock, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { getCheckoutProduct, startCheckout } from "@/lib/checkout.functions";
import { captureAttribution, type Attribution } from "@/lib/attribution";
import { initPixel, newEventId, trackPixel } from "@/lib/pixel";
import { formatMoney, fromMinorAmount, type Currency } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { VendoraLogo } from "@/components/vendora-logo";

export const Route = createFileRoute("/p/$slug")({
  loader: async ({ params }) => {
    const product = await getCheckoutProduct({ data: { slug: params.slug } });
    if (!product) throw notFound();
    return product;
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return { meta: [{ title: "Product unavailable" }, { name: "robots", content: "noindex" }] };
    }
    const title = `${loaderData.name} — secure checkout`;
    const description =
      loaderData.tagline ??
      `Buy ${loaderData.name} and get instant access to your download after payment.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        ...(loaderData.coverImageUrl?.startsWith("https://")
          ? [
              { property: "og:image", content: loaderData.coverImageUrl },
              { name: "twitter:image", content: loaderData.coverImageUrl },
            ]
          : []),
      ],
    };
  },
  notFoundComponent: () => (
    <main className="flex min-h-screen items-center justify-center px-6 text-center">
      <div>
        <h1 className="font-display text-2xl font-semibold">This product isn't available</h1>
        <p className="mt-2 text-muted-foreground">The link may be old or the product was unpublished.</p>
      </div>
    </main>
  ),
  errorComponent: () => (
    <main className="flex min-h-screen items-center justify-center px-6 text-center">
      <p className="text-muted-foreground">Checkout could not load. Please refresh and try again.</p>
    </main>
  ),
  component: CheckoutPage,
});

function CheckoutPage() {
  const product = Route.useLoaderData();
  const navigate = useNavigate();
  const start = useServerFn(startCheckout);

  const [currency, setCurrency] = useState<Currency>(product.currency);
  const [attribution, setAttribution] = useState<Attribution>({});
  const [form, setForm] = useState({ name: "", email: "" });
  const [touched, setTouched] = useState({ name: false, email: false });
  const addedToCart = useRef(false);
  const eventId = useMemo(() => newEventId(), []);

  /** Fires once, the first time the buyer starts filling in their details. */
  const trackAddToCart = () => {
    if (addedToCart.current) return;
    addedToCart.current = true;
    trackPixel("AddToCart", {
      content_name: product.name,
      content_ids: [product.id],
      content_type: "product",
      value: fromMinorAmount(priceMinor, currency),
      currency,
    });
  };

  useEffect(() => {
    setAttribution(captureAttribution());
    initPixel(product.metaPixelId);
    trackPixel("ViewContent", {
      content_name: product.name,
      content_ids: [product.id],
      content_type: "product",
      value: fromMinorAmount(product.priceMinor, product.currency),
      currency: product.currency,
    });
  }, [product.metaPixelId, product.id, product.name, product.priceMinor, product.currency]);

  const priceQuery = useMutation({
    mutationFn: (next: Currency) => getCheckoutProduct({ data: { slug: product.slug, currency: next } }),
  });
  const [priceMinor, setPriceMinor] = useState(product.priceMinor);

  const changeCurrency = async (next: Currency) => {
    setCurrency(next);
    const updated = await priceQuery.mutateAsync(next);
    if (updated) setPriceMinor(updated.priceMinor);
  };

  const checkout = useMutation({
    mutationFn: async () => {
      trackAddToCart();
      const fresh = captureAttribution();
      trackPixel("InitiateCheckout", {
        content_name: product.name,
        value: fromMinorAmount(priceMinor, currency),
        currency,
      });
      return start({
        data: {
          slug: product.slug,
          currency,
          email: form.email.trim(),
          name: form.name.trim(),
          eventId,
          attribution: Object.fromEntries(
            Object.entries(fresh).filter(([, v]) => typeof v === "string"),
          ) as Record<string, string>,
        },
      });
    },
    onSuccess: (result) => {
      if (result.checkoutUrl) {
        window.location.href = result.checkoutUrl;
        return;
      }
      navigate({ to: "/orders/$reference", params: { reference: result.reference } });
    },
    onError: (error: Error) => toast.error(error.message || "Payment could not be started"),
  });

  const nameValid = form.name.trim().length > 1;
  const emailValid = /.+@.+\..+/.test(form.email);
  const canSubmit = nameValid && emailValid && !checkout.isPending;
  const priceLabel = formatMoney(priceMinor, currency);
  const fieldClass =
    "h-12 rounded-xl border-border bg-secondary px-4 text-base focus-visible:bg-card md:text-sm";
  const invalidClass = "border-destructive focus-visible:ring-destructive/30";

  return (
    <div className="min-h-screen bg-background pb-28 sm:pb-10">
      <div className="mx-auto w-full max-w-[560px] px-4 pt-4 sm:px-6 sm:pt-10">
        <div className="panel overflow-hidden rounded-3xl">
          {/* Brand header */}
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border px-5 py-4">
            <Link to="/" className="min-w-0">
              <VendoraLogo />
            </Link>
            <div className="relative shrink-0">
              <select
                aria-label="Currency"
                value={currency}
                onChange={(event) => void changeCurrency(event.target.value as Currency)}
                className="h-9 appearance-none rounded-full bg-secondary pr-8 pl-3.5 text-xs font-semibold focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                {product.availableCurrencies.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
            </div>
          </div>

          <div className="px-5 py-6 sm:px-7">
            {/* Product visual */}
            <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-secondary">
              {product.coverImageUrl ? (
                <img
                  src={product.coverImageUrl}
                  alt={product.name}
                  className="size-full object-cover"
                />
              ) : (
                <div className="grid size-full place-items-center">
                  <Download className="size-10 text-muted-foreground/40" />
                </div>
              )}
              <span className="absolute top-3 left-3 rounded-full bg-card/90 px-3 py-1.5 text-[10px] font-bold tracking-wider text-primary uppercase shadow-sm backdrop-blur">
                Instant access
              </span>
            </div>

            {/* Product info */}
            <div className="mt-6">
              <h1 className="font-display text-2xl leading-tight font-semibold tracking-tight">
                {product.name}
              </h1>
              {product.tagline ? (
                <p className="mt-2 text-sm font-medium text-primary">{product.tagline}</p>
              ) : null}
              {product.description ? (
                <p className="mt-3 text-sm leading-relaxed whitespace-pre-line text-muted-foreground">
                  {product.description}
                </p>
              ) : null}
            </div>

            {/* Form */}
            <form
              id="checkout-form"
              className="mt-8 space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                setTouched({ name: true, email: true });
                if (canSubmit) checkout.mutate();
              }}
            >
              <p className="font-display text-xs font-bold tracking-widest uppercase">
                Your details
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-sm">
                  Full name
                </Label>
                <Input
                  id="name"
                  value={form.name}
                  onFocus={trackAddToCart}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                  onBlur={() => setTouched((t) => ({ ...t, name: true }))}
                  placeholder="Ada Obi"
                  autoComplete="name"
                  className={`${fieldClass} ${touched.name && !nameValid ? invalidClass : ""}`}
                  required
                />
                {touched.name && !nameValid ? (
                  <p className="text-xs text-destructive">Please enter your full name.</p>
                ) : null}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-sm">
                  Email for your download
                </Label>
                <Input
                  id="email"
                  type="email"
                  inputMode="email"
                  value={form.email}
                  onFocus={trackAddToCart}
                  onChange={(event) => setForm({ ...form, email: event.target.value })}
                  onBlur={() => setTouched((t) => ({ ...t, email: true }))}
                  placeholder="you@email.com"
                  autoComplete="email"
                  className={`${fieldClass} ${touched.email && !emailValid ? invalidClass : ""}`}
                  required
                />
                {touched.email && !emailValid ? (
                  <p className="text-xs text-destructive">
                    Enter a valid email — your download link goes here.
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    We send your download link to this address.
                  </p>
                )}
              </div>
            </form>

            {/* Order summary */}
            <div className="mt-8 rounded-2xl bg-secondary p-4">
              <p className="font-display text-xs font-bold tracking-widest uppercase">
                Order summary
              </p>
              <div className="mt-3 flex items-start justify-between gap-4 text-sm">
                <span className="min-w-0 text-muted-foreground">{product.name}</span>
                <span className="tabular shrink-0 font-medium">{priceLabel}</span>
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
                <span className="text-sm font-semibold">Total payable</span>
                <span className="tabular font-display text-lg font-semibold">
                  {priceLabel} <span className="text-sm text-muted-foreground">{currency}</span>
                </span>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Delivered instantly by email and on the confirmation page.
              </p>
            </div>

            {/* Trust row */}
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
              <span className="font-display text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
                Secured by
              </span>
              <div className="flex items-center gap-3 text-[11px] font-semibold text-muted-foreground">
                <span>Paystack</span>
                <span className="size-1 rounded-full bg-border" />
                <span>Flutterwave</span>
                <span className="size-1 rounded-full bg-border" />
                <span className="inline-flex items-center gap-1">
                  <Lock className="size-3" /> SSL
                </span>
              </div>
            </div>

            {/* Desktop action */}
            <div className="mt-6 hidden sm:block">
              <PayButton
                priceLabel={priceLabel}
                pending={checkout.isPending}
                disabled={!canSubmit}
              />
              <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                <ShieldCheck className="size-3.5 text-success" />
                Payment is verified on our server before your file is released.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Sticky mobile action bar */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur sm:hidden">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">Total payable</span>
          <span className="tabular font-display text-base font-semibold">
            {priceLabel} <span className="text-xs text-muted-foreground">{currency}</span>
          </span>
        </div>
        <PayButton priceLabel={priceLabel} pending={checkout.isPending} disabled={!canSubmit} />
      </div>
    </div>
  );
}

function PayButton({
  priceLabel,
  pending,
  disabled,
}: {
  priceLabel: string;
  pending: boolean;
  disabled: boolean;
}) {
  return (
    <Button
      type="submit"
      form="checkout-form"
      size="lg"
      disabled={disabled}
      className="h-13 w-full rounded-xl text-base font-semibold shadow-[0_8px_20px_oklch(0.546_0.215_263/25%)] active:scale-[0.99]"
    >
      {pending ? (
        <>
          <Loader2 className="mr-2 size-4 animate-spin" /> Starting secure payment
        </>
      ) : (
        <>
          Get instant access · {priceLabel}
          <ArrowRight className="ml-2 size-4" />
        </>
      )}
    </Button>
  );
}
