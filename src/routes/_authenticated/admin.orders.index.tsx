import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { formatMoney } from "@/lib/money";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/admin/orders/")({
  component: OrdersPage,
});

const STATUSES = ["all", "paid", "pending", "failed"] as const;

export function statusVariant(status: string) {
  if (status === "paid") return "default" as const;
  if (status === "pending") return "secondary" as const;
  return "outline" as const;
}

function OrdersPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<(typeof STATUSES)[number]>("all");

  const orders = useQuery({
    queryKey: ["admin-orders", status, search],
    queryFn: async () => {
      let query = supabase
        .from("orders")
        .select("id, reference, email, name, currency, amount_minor, status, gateway, created_at, products(name)")
        .order("created_at", { ascending: false })
        .limit(200);
      if (status !== "all") query = query.eq("status", status);
      if (search.trim()) {
        const term = `%${search.trim()}%`;
        query = query.or(`email.ilike.${term},reference.ilike.${term},name.ilike.${term}`);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Orders</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Search by buyer email, name, or order reference.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Search orders"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <div className="flex gap-1 rounded-md border border-border p-1">
          {STATUSES.map((option) => (
            <button
              key={option}
              onClick={() => setStatus(option)}
              className={`rounded px-3 py-1.5 text-sm capitalize transition-colors ${
                status === option
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b border-border text-left text-xs tracking-widest text-muted-foreground uppercase">
            <tr>
              <th className="px-4 py-3">Reference</th>
              <th className="px-4 py-3">Buyer</th>
              <th className="px-4 py-3">Product</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">Provider</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Date</th>
            </tr>
          </thead>
          <tbody>
            {(orders.data ?? []).map((order) => (
              <tr key={order.id} className="border-b border-border/60 last:border-0">
                <td className="px-4 py-3">
                  <Link
                    to="/admin/orders/$reference"
                    params={{ reference: order.reference }}
                    className="text-primary hover:underline"
                  >
                    {order.reference}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <span className="block">{order.name ?? "—"}</span>
                  <span className="text-xs text-muted-foreground">{order.email}</span>
                </td>
                <td className="px-4 py-3">{order.products?.name ?? "—"}</td>
                <td className="tabular px-4 py-3">
                  {formatMoney(Number(order.amount_minor), order.currency)}
                </td>
                <td className="px-4 py-3 capitalize">{order.gateway ?? "—"}</td>
                <td className="px-4 py-3">
                  <Badge variant={statusVariant(order.status)} className="capitalize">
                    {order.status}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {new Date(order.created_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {orders.data?.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">No orders match this view.</p>
        ) : null}
      </div>
    </div>
  );
}
