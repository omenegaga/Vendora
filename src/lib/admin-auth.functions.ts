import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const emailSchema = z.string().email().max(200).transform((value) => value.trim().toLowerCase());
const secretSchema = z.string().min(16).max(200);
const tokenSchema = z.string().regex(/^[a-f0-9]{64}$/);

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function configuredSetupSecret() {
  const secret = process.env["VENDORA_SETUP_SECRET"];
  if (!secret || secret.length < 16) throw new Error("First-admin setup is not configured");
  return secret;
}

function sameSecret(provided: string, expected: string) {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function requireAdmin(userId: string, supabase: { rpc: Function }) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!data) throw new Error("Forbidden");
}

/** Claims the initial administrator role after Supabase has created the user. */
export const claimFirstAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ setupSecret: secretSchema }).parse(input))
  .handler(async ({ data, context }) => {
    if (!sameSecret(data.setupSecret, configuredSetupSecret())) throw new Error("Invalid setup secret");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: claimed, error } = await supabaseAdmin.rpc("claim_first_admin", {
      _user_id: context.userId,
    });
    if (error) throw new Error("Could not complete administrator setup");
    if (!claimed) throw new Error("An administrator has already been created");
    return { claimed: true };
  });

/** Creates an expiring, single-use link and delivers it with Resend. */
export const inviteAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ email: emailSchema }).parse(input))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.userId, context.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { sendAdminInvitationEmail } = await import("./email.server");
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 72 * 3600_000).toISOString();
    const { error } = await (supabaseAdmin as any).from("admin_invitations").insert({
      email: data.email,
      token_hash: sha256(token),
      invited_by: context.userId,
      expires_at: expiresAt,
    });
    if (error) throw new Error("Could not create the invitation");

    const request = (await import("@tanstack/react-start/server")).getRequest();
    const url = new URL(request.url);
    const invitationUrl = `${url.origin}/activate?token=${token}`;
    const sent = await sendAdminInvitationEmail({ to: data.email, invitationUrl, expiresAt });
    if (!sent.sent) throw new Error("Invitation was created but the email could not be sent");
    return { sent: true, expiresAt };
  });

/** Exchanges a valid invitation for the server-side admin role. */
export const redeemAdminInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ token: tokenSchema }).parse(input))
  .handler(async ({ data, context }) => {
    const email = typeof context.claims.email === "string" ? context.claims.email : "";
    if (!email) throw new Error("Your account does not have an email address");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: accepted, error } = await supabaseAdmin.rpc("redeem_admin_invitation", {
      _token_hash: sha256(data.token),
      _user_id: context.userId,
      _email: email,
    });
    if (error) throw new Error("Could not activate this invitation");
    if (!accepted) throw new Error("This invitation is invalid, expired, or belongs to another email");
    return { accepted: true };
  });
