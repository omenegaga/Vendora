import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { ArrowRight, Download, Globe } from "lucide-react";

import { listStoreProducts } from "@/lib/checkout.functions";
import { formatMoney } from "@/lib/money";
import { captureAttribution } from "@/lib/attribution";
import { initPixel, newEventId, trackPixel } from "@/lib/pixel";
import { VendoraLogo } from "@/components/vendora-logo";

const storeQuery = queryOptions({
  queryKey: ["store-products"],
  queryFn: () => listStoreProducts(),
});

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Vendora — digital products, priced for your country" },
      {
        name: "description",
        content:
          "Buy instantly in Naira, Cedis, Shillings or Dollars. Secure payment and an instant download link.",
      },
      { property: "og:title", content: "Digital products, priced for your country" },
      {
        property: "og:description",
        content: "Local pricing, secure payment and instant delivery of every digital product.",
      },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(storeQuery),
  errorComponent: () => (
    <main className="flex min-h-screen items-center justify-center px-6 text-center">
      <p className="text-muted-foreground">The store could not be loaded. Please refresh.</p>
    </main>
  ),
  component: StoreFront,
});

function StoreFront() {
  const { data } = useSuspenseQuery(storeQuery);

  // Ad landings on "/" must record the click and a PageView before any product
  // page is opened.
  useEffect(() => {
    captureAttribution();
    initPixel(data.metaPixelId);
  }, [data.metaPixelId]);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-card/90 backdrop-blur">
        <div className="mx-auto grid max-w-5xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 sm:px-6">
          <VendoraLogo className="min-w-0" />
          <div className="flex shrink-0 items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-xs font-medium">
              <Globe className="size-3.5 text-muted-foreground" />
              {data.currency}
            </span>
            <Link
              to="/auth"
              className="hidden rounded-full px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground sm:inline-flex"
            >
              Admin
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 sm:px-6">
        <section className="border-b border-border py-12 sm:py-16">
          <h1 className="font-display max-w-2xl text-3xl leading-[1.1] font-semibold tracking-tight sm:text-[2.75rem]">
            Digital products, priced for where you actually live.
          </h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-muted-foreground">
            Prices are shown in {data.currency}
            {data.country ? ` for ${data.country}` : ""}. Pay with the method you already use — your
            download link arrives the second payment clears.
          </p>

        </section>

        <section className="py-10 sm:py-12">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="font-display text-lg font-semibold">Available now</h2>
            <span className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
              {data.products.length} {data.products.length === 1 ? "product" : "products"}
            </span>
          </div>

          {data.products.length === 0 ? (
            <p className="panel mt-5 rounded-2xl p-6 text-sm text-muted-foreground">
              No products are published yet.
            </p>
          ) : (
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {data.products.map((product) => (
                <Link
                  key={product.id}
                  to="/p/$slug"
                  params={{ slug: product.slug }}
                  onClick={() =>
                    trackPixel("AddToCart", {
                      content_name: product.name,
                      content_ids: [product.id],
                      content_type: "product",
                      value: product.priceMinor / 100,
                      currency: product.currency,
                    }, newEventId())
                  }
                  className="panel group flex flex-col overflow-hidden rounded-2xl transition-shadow hover:shadow-[0_2px_4px_oklch(0.19_0.028_265/6%),0_18px_44px_oklch(0.19_0.028_265/10%)]"
                >
                  <div className="relative aspect-[4/3] w-full overflow-hidden bg-secondary">
                    {product.coverImageUrl ? (
                      <img
                        src={product.coverImageUrl}
                        alt={product.name}
                        loading="lazy"
                        className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                      />
                    ) : (
                      <div className="grid size-full place-items-center">
                        <Download className="size-8 text-muted-foreground/40" />
                      </div>
                    )}
                    <span className="absolute top-3 left-3 rounded-full bg-card/90 px-2.5 py-1 text-[10px] font-bold tracking-wider text-primary uppercase shadow-sm backdrop-blur">
                      Instant access
                    </span>
                  </div>
                  <div className="flex flex-1 flex-col p-5">
                    <h3 className="font-display text-base leading-snug font-semibold">
                      {product.name}
                    </h3>
                    {product.tagline ? (
                      <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                        {product.tagline}
                      </p>
                    ) : null}
                    <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
                      <span className="tabular font-display text-lg font-semibold">
                        {formatMoney(product.priceMinor, product.currency)}
                      </span>
                      <span className="inline-flex items-center gap-1 text-sm font-semibold text-primary">
                        Buy
                        <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </main>

      <footer className="border-t border-border py-8">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-4 sm:px-6">
          <p className="text-xs text-muted-foreground">
            Payments secured by Paystack and Flutterwave · SSL encrypted
          </p>
          <Link to="/auth" className="text-xs font-medium text-muted-foreground hover:text-foreground">
            Admin sign in
          </Link>
        </div>
      </footer>
    </div>
  );
}
