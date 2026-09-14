import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AlertCircle, Check, X } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { getIntegrationStatus, saveMetaCapiToken } from "@/lib/admin.functions";
import { inviteAdmin } from "@/lib/admin-auth.functions";
import { SUPPORTED_CURRENCIES, CURRENCY_LABELS } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/admin/settings")({
  component: SettingsPage,
});

const ROUTING_OPTIONS = [
  { value: "paystack,flutterwave", label: "Paystack first, then Flutterwave" },
  { value: "flutterwave,paystack", label: "Flutterwave first, then Paystack" },
  { value: "paystack", label: "Paystack only" },
  { value: "flutterwave", label: "Flutterwave only" },
] as const;

type Draft = {
  store_name: string;
  support_email: string;
  email_sender_name: string;
  download_expiry_hours: string;
  default_currency: string;
  meta_pixel_id: string;
  meta_test_event_code: string;
  gateway_routing: Record<string, string>;
  fx_rates: Record<string, string>;
};

function SettingsPage() {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Draft | null>(null);
  const fetchStatus = useServerFn(getIntegrationStatus);
  const saveCapiToken = useServerFn(saveMetaCapiToken);
  const sendInvite = useServerFn(inviteAdmin);
  const [inviteEmail, setInviteEmail] = useState("");
  const [metaCapiToken, setMetaCapiToken] = useState("");

  const settings = useQuery({
    queryKey: ["admin-settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("settings").select("*").eq("id", true).single();
      if (error) throw error;
      return data;
    },
  });

  const status = useQuery({ queryKey: ["integration-status"], queryFn: () => fetchStatus() });

  useEffect(() => {
    const data = settings.data;
    if (!data) return;
    const routing = (data.gateway_routing ?? {}) as Record<string, string[]>;
    const rates = (data.fx_rates ?? {}) as Record<string, number>;
    setDraft({
      store_name: data.store_name,
      support_email: data.support_email ?? "",
      email_sender_name: data.email_sender_name,
      download_expiry_hours: String(data.download_expiry_hours),
      default_currency: data.default_currency ?? "NGN",
      meta_pixel_id: data.meta_pixel_id ?? "",
      meta_test_event_code: data.meta_test_event_code ?? "",
      gateway_routing: Object.fromEntries(
        SUPPORTED_CURRENCIES.map((currency) => [
          currency,
          (routing[currency] ?? ["paystack", "flutterwave"]).join(","),
        ]),
      ),
      fx_rates: Object.fromEntries(
        SUPPORTED_CURRENCIES.map((currency) => [currency, rates[currency] ? String(rates[currency]) : ""]),
      ),
    });
  }, [settings.data]);

  const save = useMutation({
    mutationFn: async () => {
      if (!draft) return;
      const { error } = await supabase
        .from("settings")
        .update({
          store_name: draft.store_name.trim(),
          support_email: draft.support_email.trim() || null,
          email_sender_name: draft.email_sender_name.trim(),
          download_expiry_hours: Math.max(1, Number(draft.download_expiry_hours || 72)),
          default_currency: draft.default_currency,
          meta_pixel_id: draft.meta_pixel_id.trim() || null,
          meta_test_event_code: draft.meta_test_event_code.trim() || null,
          gateway_routing: Object.fromEntries(
            Object.entries(draft.gateway_routing).map(([currency, value]) => [
              currency,
              value.split(","),
            ]),
          ),
          fx_rates: Object.fromEntries(
            Object.entries(draft.fx_rates).flatMap(([currency, value]) => {
              const rate = Number(value);
              return Number.isFinite(rate) && rate > 0 ? [[currency, rate]] : [];
            }),
          ),
        })
        .eq("id", true);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Settings saved");
      void queryClient.invalidateQueries({ queryKey: ["admin-settings"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const invite = useMutation({
    mutationFn: () => sendInvite({ data: { email: inviteEmail } }),
    onSuccess: () => {
      setInviteEmail("");
      toast.success("Administrator invitation sent");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const saveCapi = useMutation({
    mutationFn: () => saveCapiToken({ data: { token: metaCapiToken } }),
    onSuccess: () => {
      setMetaCapiToken("");
      toast.success("Meta CAPI token saved securely");
      void queryClient.invalidateQueries({ queryKey: ["integration-status"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (!draft) return <p className="text-sm text-muted-foreground">Loading settings…</p>;

  const missingFxRates = SUPPORTED_CURRENCIES.filter((currency) => {
    const value = Number(draft.fx_rates[currency]);
    return !Number.isFinite(value) || value <= 0;
  });
  const integrationStatusError =
    status.error instanceof Error ? status.error.message : "Unable to check integration status.";

  return (
    <div className="max-w-3xl space-y-8">
      <header>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Store details, payment routing, tracking, and delivery.
        </p>
      </header>

      <section className="space-y-4 rounded-xl border border-border bg-card p-6">
        <h2 className="font-display text-lg font-semibold">Store</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="store">Store name</Label>
            <Input
              id="store"
              value={draft.store_name}
              onChange={(e) => setDraft({ ...draft, store_name: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="support">Support email</Label>
            <Input
              id="support"
              value={draft.support_email}
              onChange={(e) => setDraft({ ...draft, support_email: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sender">Email sender name</Label>
            <Input
              id="sender"
              value={draft.email_sender_name}
              onChange={(e) => setDraft({ ...draft, email_sender_name: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="expiry">Download link valid for (hours)</Label>
            <Input
              id="expiry"
              type="number"
              min="1"
              value={draft.download_expiry_hours}
              onChange={(e) => setDraft({ ...draft, download_expiry_hours: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="default-currency">Default store currency</Label>
            <select
              id="default-currency"
              value={draft.default_currency}
              onChange={(e) => setDraft({ ...draft, default_currency: e.target.value })}
              className="h-11 w-full rounded-md border border-input bg-surface px-3 text-sm"
            >
              {SUPPORTED_CURRENCIES.map((code) => (
                <option key={code} value={code}>
                  {code} — {CURRENCY_LABELS[code]}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">Used when we can't tell a buyer's country.</p>
          </div>
        </div>
      </section>


      <section className="space-y-4 rounded-xl border border-border bg-card p-6">
        <h2 className="font-display text-lg font-semibold">Payment routing</h2>
        <p className="text-sm text-muted-foreground">
          Choose which provider handles each currency. If the first one fails, the next is tried
          automatically.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          {SUPPORTED_CURRENCIES.map((currency) => (
            <div key={currency} className="space-y-2">
              <Label htmlFor={`route-${currency}`}>
                {currency} — {CURRENCY_LABELS[currency]}
              </Label>
              <select
                id={`route-${currency}`}
                value={draft.gateway_routing[currency]}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    gateway_routing: { ...draft.gateway_routing, [currency]: e.target.value },
                  })
                }
                className="h-9 w-full rounded-md border border-input bg-surface px-3 text-sm"
              >
                {ROUTING_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>

        {status.isError ? (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <span>Integration status could not be checked: {integrationStatusError}</span>
          </p>
        ) : status.isPending ? (
          <p className="text-sm text-muted-foreground">Checking integration status…</p>
        ) : (
          <div className="grid gap-4 pt-2 sm:grid-cols-2">
            {(
              [
                ["Paystack keys", status.data?.paystack],
                ["Flutterwave keys", status.data?.flutterwave],
                ["Flutterwave webhook hash", status.data?.flutterwaveWebhookHash],
                ["Meta server events token", status.data?.metaCapiToken],
                ["Email sending", status.data?.emailSending],
              ] as const
            ).map(([label, ok]) => (
              <p key={label} className="flex items-center gap-2 text-sm">
                {ok ? (
                  <Check className="size-4 text-accent" />
                ) : (
                  <X className="size-4 text-muted-foreground" />
                )}
                <span className={ok ? "" : "text-muted-foreground"}>
                  {label}: {ok ? "connected" : "not set up"}
                </span>
              </p>
            ))}
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          While no provider is connected, checkout runs in test mode so you can walk the full flow.
        </p>
      </section>

      <section className="space-y-4 rounded-xl border border-border bg-card p-6">
        <h2 className="font-display text-lg font-semibold">Automatic conversion rates</h2>
        <p className="text-sm text-muted-foreground">
          Used only when a product has no exact price for a currency. Value per 1 USD. A currency is not offered at checkout until it has either an exact product price or a valid rate.
        </p>
        {missingFxRates.length ? (
          <p className="rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning">
            Rates still needed: {missingFxRates.join(", ")}. Set a rate or add an exact product price before offering these currencies.
          </p>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-4">
          {SUPPORTED_CURRENCIES.map((currency) => (
            <div key={currency} className="space-y-2">
              <Label htmlFor={`fx-${currency}`}>{currency}</Label>
              <Input
                id={`fx-${currency}`}
                type="number"
                min="0"
                step="0.0001"
                value={draft.fx_rates[currency]}
                placeholder="Required for automatic pricing"
                onChange={(e) =>
                  setDraft({ ...draft, fx_rates: { ...draft.fx_rates, [currency]: e.target.value } })
                }
              />
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4 rounded-xl border border-border bg-card p-6">
        <h2 className="font-display text-lg font-semibold">Meta tracking</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="pixel">Pixel ID</Label>
            <Input
              id="pixel"
              value={draft.meta_pixel_id}
              onChange={(e) => setDraft({ ...draft, meta_pixel_id: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="test-code">Test event code (optional)</Label>
            <Input
              id="test-code"
              value={draft.meta_test_event_code}
              onChange={(e) => setDraft({ ...draft, meta_test_event_code: e.target.value })}
            />
          </div>
        </div>
        <div className="space-y-2 border-t border-border pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label htmlFor="capi-token">Conversions API access token</Label>
            <span className={`text-xs font-medium ${status.data?.metaCapiToken ? "text-accent" : "text-muted-foreground"}`}>
              {status.isError
                ? "Status unavailable"
                : status.isPending
                  ? "Checking…"
                  : status.data?.metaCapiToken
                    ? "Configured"
                    : "Not configured"}
            </span>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Input
              id="capi-token"
              type="password"
              autoComplete="off"
              placeholder={status.data?.metaCapiToken ? "Enter a new token to replace the current one" : "Paste your Meta CAPI access token"}
              value={metaCapiToken}
              onChange={(event) => setMetaCapiToken(event.target.value)}
            />
            <Button
              type="button"
              variant="secondary"
              className="shrink-0"
              disabled={metaCapiToken.trim().length < 20 || saveCapi.isPending}
              onClick={() => saveCapi.mutate()}
            >
              {status.data?.metaCapiToken ? "Replace token" : "Save token"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Stored server-side only. Vendora never displays the saved token again.
          </p>
        </div>
      </section>

      <section className="space-y-4 rounded-xl border border-border bg-card p-6">
        <h2 className="font-display text-lg font-semibold">Administrators</h2>
        <p className="text-sm text-muted-foreground">
          Invite a trusted teammate. They receive a single-use activation link that expires after 72 hours.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Input
            type="email"
            aria-label="Administrator email"
            placeholder="teammate@company.com"
            value={inviteEmail}
            onChange={(event) => setInviteEmail(event.target.value)}
          />
          <Button
            type="button"
            className="shrink-0"
            disabled={!/.+@.+\..+/.test(inviteEmail) || invite.isPending}
            onClick={() => invite.mutate()}
          >
            Send invitation
          </Button>
        </div>
      </section>

      <Button onClick={() => save.mutate()} disabled={save.isPending}>
        Save settings
      </Button>
    </div>
  );
}
