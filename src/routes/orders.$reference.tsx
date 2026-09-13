import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef } from "react";
import { CheckCircle2, Clock, Download, Loader2, Mail, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { confirmTestOrder, resendAccessEmail, verifyOrder } from "@/lib/checkout.functions";
import { fromMinorAmount } from "@/lib/money";
import { formatMoney } from "@/lib/money";
import { initPixel, trackPixel } from "@/lib/pixel";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/orders/$reference")({
  head: () => ({
    meta: [
      { title: "Your order and download" },
      { name: "description", content: "Payment confirmation and your download link." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Your order and download" },
      { property: "og:description", content: "Payment confirmation and your download link." },
    ],
  }),
  component: OrderPage,
});

function OrderPage() {
  const { reference } = Route.useParams();
  const verify = useServerFn(verifyOrder);
  const confirmTest = useServerFn(confirmTestOrder);
  const resend = useServerFn(resendAccessEmail);
  const trackedRef = useRef(false);

  const order = useQuery({
    queryKey: ["order", reference],
    queryFn: () => verify({ data: { reference } }),
    refetchInterval: (query) => (query.state.data?.status === "paid" ? false : 5000),
  });

  const data = order.data;

  useEffect(() => {
    if (!data || data.status !== "paid" || trackedRef.current) return;
    trackedRef.current = true;
    initPixel(data.metaPixelId);
    trackPixel(
      "Purchase",
      {
        value: fromMinorAmount(data.amountMinor, data.currency),
        currency: data.currency,
        content_name: data.productName ?? undefined,
      },
      data.metaEventId ?? data.reference,
    );
  }, [data]);

  const simulate = useMutation({
    mutationFn: () => confirmTest({ data: { reference } }),
    onSuccess: () => {
      toast.success("Test payment recorded");
      void order.refetch();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const resendEmail = useMutation({
    mutationFn: () => resend({ data: { reference } }),
    onSuccess: (result) =>
      result.sent
        ? toast.success("Access email sent again")
        : toast.error("Email sending isn't set up yet — use the download button below."),
  });

  if (order.isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </main>
    );
  }

  if (!data) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6 text-center">
        <div>
          <h1 className="font-display text-2xl font-semibold">Order not found</h1>
          <p className="mt-2 text-muted-foreground">Check the link in your email and try again.</p>
        </div>
      </main>
    );
  }

  const paid = data.status === "paid";

  return (
    <main className="min-h-screen grid-noise">
      <div className="mx-auto max-w-xl px-6 py-16">
        <div className="rounded-xl border border-border bg-card p-8">
          <div
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs ${
              paid ? "bg-success/15 text-success" : "bg-warning/15 text-warning"
            }`}
          >
            {paid ? <CheckCircle2 className="size-3.5" /> : <Clock className="size-3.5" />}
            {paid ? "Payment confirmed" : "Waiting for payment"}
          </div>

          <h1 className="mt-5 text-2xl font-semibold">
            {paid ? "Your download is ready" : "We haven't received this payment yet"}
          </h1>
          <p className="mt-2 text-muted-foreground">
            {data.productName ?? "Your purchase"} —{" "}
            <span className="tabular">{formatMoney(data.amountMinor, data.currency)}</span>
          </p>

          <dl className="mt-6 space-y-2 border-t border-border pt-6 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Reference</dt>
              <dd className="tabular">{data.reference}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Email</dt>
              <dd>{data.email}</dd>
            </div>
            {data.gateway ? (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Paid with</dt>
                <dd className="capitalize">{data.gateway}</dd>
              </div>
            ) : null}
            {paid && data.downloadExpiresAt ? (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Link expires</dt>
                <dd>{new Date(data.downloadExpiresAt).toLocaleString()}</dd>
              </div>
            ) : null}
          </dl>

          <div className="mt-8 space-y-3">
            {paid && data.downloadUrl ? (
              <>
                <Button asChild size="lg" className="w-full">
                  <a href={data.downloadUrl}>
                    <Download className="mr-2 size-4" /> Download now
                  </a>
                </Button>
                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={() => resendEmail.mutate()}
                  disabled={resendEmail.isPending}
                >
                  <Mail className="mr-2 size-4" /> Email me the link again
                </Button>
              </>
            ) : null}

            {!paid && data.checkoutUrl ? (
              <Button asChild size="lg" className="w-full">
                <a href={data.checkoutUrl}>Continue payment</a>
              </Button>
            ) : null}

            {!paid && data.testMode ? (
              <Button
                variant="secondary"
                className="w-full"
                onClick={() => simulate.mutate()}
                disabled={simulate.isPending}
              >
                Simulate a successful payment (test mode)
              </Button>
            ) : null}

            {!paid ? (
              <Button
                variant="ghost"
                className="w-full"
                onClick={() => void order.refetch()}
                disabled={order.isFetching}
              >
                <RefreshCw className="mr-2 size-4" /> Check again
              </Button>
            ) : null}
          </div>

          {paid && !data.accessEmailSent ? (
            <p className="mt-6 text-xs text-muted-foreground">
              Email delivery isn't switched on yet, so use the download button above. Bookmark this
              page — it keeps working until the link expires.
            </p>
          ) : null}
        </div>
      </div>
    </main>
  );
}
