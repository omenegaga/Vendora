import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Mail } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { resendAccessEmail } from "@/lib/checkout.functions";
import { formatMoney } from "@/lib/money";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/admin/orders/$reference")({
  component: OrderDetail,
});

function OrderDetail() {
  const { reference } = Route.useParams();
  const resend = useServerFn(resendAccessEmail);

  const order = useQuery({
    queryKey: ["admin-order", reference],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, products(name, slug)")
        .eq("reference", reference)
        .single();
      if (error) throw error;
      return data;
    },
  });

  if (!order.data) return <p className="text-sm text-muted-foreground">Loading order…</p>;
  const data = order.data;
  const attribution = (data.attribution ?? {}) as Record<string, unknown>;

  const handleResend = async () => {
    const result = await resend({ data: { reference } });
    if (result.sent) toast.success("Access email sent");
    else toast.error(result.reason ?? "Email sending isn't set up yet");
  };

  return (
    <div className="max-w-3xl space-y-8">
      <Link
        to="/admin/orders"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> All orders
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold">{data.reference}</h1>
          <p className="tabular mt-1 text-lg text-primary">
            {formatMoney(Number(data.amount_minor), data.currency)}
          </p>
        </div>
        <Badge className="capitalize">{data.status}</Badge>
      </header>

      <section className="grid gap-6 rounded-xl border border-border bg-card p-6 sm:grid-cols-2">
        <Field label="Buyer" value={data.name ?? "—"} />
        <Field label="Email" value={data.email} />
        <Field label="Phone" value={data.phone ?? "—"} />
        <Field label="Country" value={data.country ?? "—"} />
        <Field label="Product" value={data.products?.name ?? "—"} />
        <Field label="Provider" value={data.gateway ?? "—"} />
        <Field label="Provider reference" value={data.gateway_reference ?? "—"} />
        <Field label="Providers tried" value={(data.gateway_attempted ?? []).join(", ") || "—"} />
        <Field
          label="Paid at"
          value={data.paid_at ? new Date(data.paid_at).toLocaleString() : "—"}
        />
        <Field
          label="Download expires"
          value={
            data.download_expires_at ? new Date(data.download_expires_at).toLocaleString() : "—"
          }
        />
        <Field label="Downloads" value={String(data.download_count ?? 0)} />
        <Field
          label="Access email"
          value={
            data.access_email_sent_at ? new Date(data.access_email_sent_at).toLocaleString() : "not sent"
          }
        />
      </section>

      <section className="space-y-4 rounded-xl border border-border bg-card p-6">
        <h2 className="font-display text-lg font-semibold">Attribution</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {["fbclid", "fbp", "fbc", "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "referrer", "landing_page"].map(
            (key) => (
              <Field key={key} label={key} value={String(attribution[key] ?? "—")} />
            ),
          )}
        </div>
        <Field label="Meta event id" value={data.meta_event_id ?? "—"} />
        <Field
          label="Server event sent"
          value={data.meta_capi_sent_at ? new Date(data.meta_capi_sent_at).toLocaleString() : "—"}
        />
      </section>

      {data.status === "paid" ? (
        <Button variant="secondary" onClick={() => void handleResend()}>
          <Mail className="mr-2 size-4" /> Resend access email
        </Button>
      ) : null}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs tracking-widest text-muted-foreground uppercase">{label}</p>
      <p className="mt-1 truncate text-sm">{value}</p>
    </div>
  );
}
