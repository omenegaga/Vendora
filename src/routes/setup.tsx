import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { claimFirstAdmin } from "@/lib/admin-auth.functions";
import { VendoraLogo } from "@/components/vendora-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/setup")({ component: SetupPage });

const SETUP_STORAGE_KEY = "vendora_first_admin_setup_v1";
type PendingSetup = { email: string; setupSecret: string };

function redirectUrl() {
  return `${window.location.origin}/setup`;
}

function readPendingSetup(): PendingSetup | null {
  try {
    const value = window.sessionStorage.getItem(SETUP_STORAGE_KEY);
    if (!value) return null;
    const parsed = JSON.parse(value) as Partial<PendingSetup>;
    return typeof parsed.email === "string" && typeof parsed.setupSecret === "string"
      ? { email: parsed.email, setupSecret: parsed.setupSecret }
      : null;
  } catch {
    return null;
  }
}

function savePendingSetup(value: PendingSetup) {
  window.sessionStorage.setItem(SETUP_STORAGE_KEY, JSON.stringify(value));
}

function clearPendingSetup() {
  window.sessionStorage.removeItem(SETUP_STORAGE_KEY);
}

function SetupPage() {
  const navigate = useNavigate();
  const claim = useServerFn(claimFirstAdmin);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [setupSecret, setSetupSecret] = useState("");
  const [busy, setBusy] = useState(false);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
  const completing = useRef(false);

  const completeFirstAdminSetup = async (secret: string) => {
    if (completing.current) return;
    completing.current = true;
    setBusy(true);
    try {
      await claim({ data: { setupSecret: secret } });
      clearPendingSetup();
      toast.success("Vendora administrator created");
      navigate({ to: "/admin" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Administrator setup failed");
    } finally {
      completing.current = false;
      setBusy(false);
    }
  };

  // Supabase establishes the client session after its confirmation redirect.
  // Resume the server-side role claim, then erase the session-scoped secret.
  useEffect(() => {
    const pending = readPendingSetup();
    if (pending) {
      setEmail((current) => current || pending.email);
      setAwaitingConfirmation(true);
    }
    const resume = (session: { user: unknown } | null) => {
      const resume = readPendingSetup();
      if (session && resume) void completeFirstAdminSetup(resume.setupSecret);
    };
    void supabase.auth.getSession().then(({ data }) => resume(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => resume(session));
    return () => listener.subscription.unsubscribe();
    // Run once on the confirmation redirect only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    const pending = { email: email.trim().toLowerCase(), setupSecret };
    try {
      savePendingSetup(pending);
      const { data: currentAuth } = await supabase.auth.getSession();
      if (currentAuth.session) {
        await completeFirstAdminSetup(pending.setupSecret);
        return;
      }
      const { data, error } = await supabase.auth.signUp({
        email: pending.email,
        password,
        options: { emailRedirectTo: redirectUrl() },
      });
      if (error) throw error;
      if (!data.session) {
        setAwaitingConfirmation(true);
        toast.success("Check your email to confirm your account. You can request a new link below if needed.");
        return;
      }
      await completeFirstAdminSetup(pending.setupSecret);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Setup failed");
    } finally {
      setBusy(false);
    }
  };

  const resendConfirmation = async () => {
    const pending = readPendingSetup();
    const address = (pending?.email ?? email).trim().toLowerCase();
    if (!address) {
      toast.error("Enter the email address used for setup first.");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: address,
        options: { emailRedirectTo: redirectUrl() },
      });
      if (error) throw error;
      setAwaitingConfirmation(true);
      toast.success("A new confirmation email has been sent.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not resend the confirmation email");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="grid-noise flex min-h-screen items-center justify-center px-6">
      <form onSubmit={submit} className="w-full max-w-sm space-y-5 rounded-xl border border-border bg-card p-8">
        <VendoraLogo />
        <div>
          <h1 className="text-2xl font-semibold">Set up Vendora</h1>
          <p className="mt-2 text-sm text-muted-foreground">Create the first administrator. This is available once and needs your server setup secret.</p>
        </div>
        <div className="space-y-2"><Label htmlFor="setup-email">Email</Label><Input id="setup-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
        <div className="space-y-2"><Label htmlFor="setup-password">Password</Label><Input id="setup-password" type="password" autoComplete="new-password" minLength={12} value={password} onChange={(e) => setPassword(e.target.value)} required /><p className="text-xs text-muted-foreground">Use at least 12 characters.</p></div>
        <div className="space-y-2"><Label htmlFor="setup-secret">Setup secret</Label><Input id="setup-secret" type="password" autoComplete="off" minLength={16} value={setupSecret} onChange={(e) => setSetupSecret(e.target.value)} required /></div>
        <Button type="submit" className="w-full" disabled={busy}>{busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}Create first administrator</Button>
        {awaitingConfirmation ? <Button type="button" variant="secondary" className="w-full" disabled={busy} onClick={() => void resendConfirmation()}>Resend confirmation email</Button> : null}
      </form>
    </main>
  );
}
