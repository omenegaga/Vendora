-- This table is deliberately separate from public.settings, which buyers may read
-- to obtain the Pixel ID. No browser role can select or update this credential.
CREATE TABLE public.integration_secrets (
  id boolean PRIMARY KEY DEFAULT true,
  meta_capi_token text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT integration_secrets_single_row CHECK (id)
);

GRANT ALL ON public.integration_secrets TO service_role;
REVOKE ALL ON public.integration_secrets FROM anon, authenticated;
ALTER TABLE public.integration_secrets ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER integration_secrets_updated_at BEFORE UPDATE ON public.integration_secrets
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
