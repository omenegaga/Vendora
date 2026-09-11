import { supabaseAdmin } from "@/integrations/supabase/client.server";

/** Service-role-only Meta credential access. Never import this from client code. */
export async function getMetaCapiToken(): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from("integration_secrets")
    .select("meta_capi_token")
    .eq("id", true)
    .maybeSingle();
  if (error) throw new Error("Meta CAPI credentials are unavailable");
  return data?.meta_capi_token?.trim() || null;
}

export async function hasMetaCapiToken(): Promise<boolean> {
  return Boolean(await getMetaCapiToken());
}
