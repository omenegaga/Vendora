import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { formatMoney } from "@/lib/money";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/admin/customers")({
  component: CustomersPage,
});

function CustomersPage() {
  const [search, setSearch] = useState("");

  const customers = useQuery({
    queryKey: ["admin-customers"],
    queryFn: async () => {
      const [{ data: people, error }, { data: orders }] = await Promise.all([
        supabase
          .from("customers")
          .select("id, email, name, phone, country, created_at")
          .order("created_at", { ascending: false })
          .limit(500),
        supabase
          .from("orders")
          .select("email, currency, amount_minor, status")
          .eq("status", "paid")
          .limit(1000),
      ]);
      if (error) throw error;

      const spend = new Map<string, { count: number; totals: Map<string, number> }>();
      for (const order of orders ?? []) {
        const entry = spend.get(order.email) ?? { count: 0, totals: new Map<string, number>() };
        entry.count += 1;
        entry.totals.set(
          order.currency,
          (entry.totals.get(order.currency) ?? 0) + Number(order.amount_minor),
        );
        spend.set(order.email, entry);
      }

      return (people ?? []).map((person) => ({
        ...person,
        orders: spend.get(person.email)?.count ?? 0,
        totals: [...(spend.get(person.email)?.totals.entries() ?? [])],
      }));
    },
  });

  const term = search.trim().toLowerCase();
  const rows = (customers.data ?? []).filter(
    (row) =>
      !term ||
      row.email.toLowerCase().includes(term) ||
      (row.name ?? "").toLowerCase().includes(term),
  );

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Customers</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Everyone who has bought, with what they've spent in each currency.
        </p>
      </header>

      <Input
        placeholder="Search customers"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-xs"
      />

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b border-border text-left text-xs tracking-widest text-muted-foreground uppercase">
            <tr>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">Country</th>
              <th className="px-4 py-3">Orders</th>
              <th className="px-4 py-3">Spent</th>
              <th className="px-4 py-3">First seen</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-border/60 last:border-0">
                <td className="px-4 py-3">
                  <span className="block">{row.name ?? "—"}</span>
                  <span className="text-xs text-muted-foreground">{row.email}</span>
                </td>
                <td className="px-4 py-3">{row.phone ?? "—"}</td>
                <td className="px-4 py-3">{row.country ?? "—"}</td>
                <td className="tabular px-4 py-3">{row.orders}</td>
                <td className="tabular px-4 py-3">
                  {row.totals.length === 0
                    ? "—"
                    : row.totals.map(([currency, total]) => (
                        <span key={currency} className="mr-3 whitespace-nowrap">
                          {formatMoney(total, currency)}
                        </span>
                      ))}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {new Date(row.created_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">No customers yet.</p>
        ) : null}
      </div>
    </div>
  );
}
