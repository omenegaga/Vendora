import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type IntegrationStatus = {
  paystack: boolean;
  flutterwave: boolean;
  flutterwaveWebhookHash: boolean;
  metaCapiToken: boolean;
  emailSending: boolean;
};

/** Admin-only: which gateway/tracking credentials are present on the server. */
export const getIntegrationStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<IntegrationStatus> => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

    const present = (name: string) => {
      const value = process.env[name];
      return !!value && value.trim().length > 0;
    };

    const { hasMetaCapiToken } = await import("./meta-credentials.server");
    return {
      paystack: present("PAYSTACK_SECRET_KEY"),
      flutterwave: present("FLUTTERWAVE_SECRET_KEY"),
      flutterwaveWebhookHash: present("FLUTTERWAVE_SECRET_HASH"),
      metaCapiToken: await hasMetaCapiToken(),
      emailSending: present("RESEND_API_KEY") && present("EMAIL_FROM_ADDRESS"),
    };
  });

/** Admin-only: writes a replacement CAPI token to the service-role-only table. */
export const saveMetaCapiToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ token: z.string().trim().min(20).max(2000) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("integration_secrets").upsert({
      id: true,
      meta_capi_token: data.token,
    });
    if (error) throw new Error("Could not save the Meta CAPI token");
    return { configured: true };
  });
