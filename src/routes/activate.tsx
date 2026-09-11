import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { redeemAdminInvitation } from "@/lib/admin-auth.functions";
import { VendoraLogo } from "@/components/vendora-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/activate")({ validateSearch: (search: Record<string, unknown>) => ({ token: typeof search.token === "string" ? search.token : "" }), component: ActivatePage });

function ActivatePage() {
  const { token } = Route.useSearch();
  const navigate = useNavigate();
  const redeem = useServerFn(redeemAdminInvitation);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true);
    try {
      if (!/^[a-f0-9]{64}$/.test(token)) throw new Error("This invitation link is invalid");
      const { data, error } = await supabase.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: `${window.location.origin}/activate?token=${token}` } });
      if (error) throw error;
      if (!data.session) { toast.success("Check your inbox to confirm your account, then reopen this invitation link."); return; }
      await redeem({ data: { token } });
      toast.success("Your Vendora admin access is active"); navigate({ to: "/admin" });
    } catch (error) { toast.error(error instanceof Error ? error.message : "Activation failed"); } finally { setBusy(false); }
  };

  return <main className="grid-noise flex min-h-screen items-center justify-center px-6"><form onSubmit={submit} className="w-full max-w-sm rounded-xl border border-border bg-card p-8 space-y-5"><VendoraLogo /><div><h1 className="text-2xl font-semibold">Activate admin access</h1><p className="mt-2 text-sm text-muted-foreground">Create an account using the email address that received this invitation.</p></div><div className="space-y-2"><Label htmlFor="invite-email">Email</Label><Input id="invite-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div><div className="space-y-2"><Label htmlFor="invite-password">Password</Label><Input id="invite-password" type="password" autoComplete="new-password" minLength={12} value={password} onChange={(e) => setPassword(e.target.value)} required /></div><Button type="submit" className="w-full" disabled={busy}>{busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}Create account and activate</Button></form></main>;
}
