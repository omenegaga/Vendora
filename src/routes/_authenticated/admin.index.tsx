import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { formatMoney } from "@/lib/money";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: RevenuePage,
});

const RANGES = [
  { key: "7", label: "7 days", days: 7 },
  { key: "30", label: "30 days", days: 30 },
  { key: "90", label: "90 days", days: 90 },
  { key: "all", label: "All time", days: null },
] as const;

type PaidOrder = {
  currency: string;
  amount_minor: number;
  gateway: string | null;
  paid_at: string | null;
  product_id: string | null;
  products: { name: string } | null;
};

function RevenuePage() {
  const [range, setRange] = useState<(typeof RANGES)[number]["key"]>("30");
  const days = RANGES.find((r) => r.key === range)?.days ?? null;

  const orders = useQuery({
    queryKey: ["revenue", range],
    queryFn: async () => {
      let query = supabase
        .from("orders")
        .select("currency, amount_minor, gateway, paid_at, product_id, products(name)")
        .eq("status", "paid")
        .order("paid_at", { ascending: false })
        .limit(1000);
      if (days) {
        query = query.gte("paid_at", new Date(Date.now() - days * 864e5).toISOString());
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as PaidOrder[];
    },
  });

  const pending = useQuery({
    queryKey: ["pending-count"],
    queryFn: async () => {
      const { count } = await supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending");
      return count ?? 0;
    },
  });

  const rows = orders.data ?? [];

  const byCurrency = new Map<string, { total: number; count: number }>();
  const byProduct = new Map<string, Map<string, number>>();
  const byGateway = new Map<string, Map<string, number>>();

  for (const row of rows) {
    const currency = row.currency;
    const amount = Number(row.amount_minor);

    const c = byCurrency.get(currency) ?? { total: 0, count: 0 };
    byCurrency.set(currency, { total: c.total + amount, count: c.count + 1 });

    const productName = row.products?.name ?? "Deleted product";
    const p = byProduct.get(productName) ?? new Map<string, number>();
    p.set(currency, (p.get(currency) ?? 0) + amount);
    byProduct.set(productName, p);

    const gateway = row.gateway ?? "unknown";
    const g = byGateway.get(gateway) ?? new Map<string, number>();
    g.set(currency, (g.get(currency) ?? 0) + amount);
    byGateway.set(gateway, g);
  }

  return (
    <div className="space-y-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Revenue</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every total stays in the currency it was collected in — nothing is blended.
          </p>
        </div>
        <div className="flex gap-1 rounded-md border border-border p-1">
          {RANGES.map((option) => (
            <button
              key={option.key}
              onClick={() => setRange(option.key)}
              className={`rounded px-3 py-1.5 text-sm transition-colors ${
                range === option.key
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {byCurrency.size === 0 ? (
          <p className="text-sm text-muted-foreground">No paid orders in this period yet.</p>
        ) : (
          [...byCurrency.entries()].map(([currency, value]) => (
            <div key={currency} className="rounded-xl border border-border bg-card p-5">
              <p className="text-xs tracking-widest text-muted-foreground uppercase">{currency}</p>
              <p className="tabular font-display mt-2 text-2xl font-semibold text-primary">
                {formatMoney(value.total, currency)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {value.count} paid order{value.count === 1 ? "" : "s"}
              </p>
            </div>
          ))
        )}
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-xs tracking-widest text-muted-foreground uppercase">Awaiting payment</p>
          <p className="tabular font-display mt-2 text-2xl font-semibold">{pending.data ?? 0}</p>
          <p className="mt-1 text-xs text-muted-foreground">orders started, not paid</p>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Breakdown title="By product" data={byProduct} />
        <Breakdown title="By payment provider" data={byGateway} />
      </section>
    </div>
  );
}

function Breakdown({ title, data }: { title: string; data: Map<string, Map<string, number>> }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h2 className="text-sm font-medium tracking-widest text-muted-foreground uppercase">{title}</h2>
      {data.size === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">Nothing yet.</p>
      ) : (
        <ul className="mt-4 space-y-4">
          {[...data.entries()].map(([label, currencies]) => (
            <li key={label} className="border-b border-border pb-3 last:border-0 last:pb-0">
              <p className="text-sm font-medium capitalize">{label}</p>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                {[...currencies.entries()].map(([currency, total]) => (
                  <span key={currency} className="tabular">
                    {formatMoney(total, currency)}
                  </span>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
