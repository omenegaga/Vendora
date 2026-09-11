-- Admin accounts are explicitly provisioned. Remove the old implicit
-- "first sign-up wins" trigger before enabling the setup screen.
DROP TRIGGER IF EXISTS on_auth_user_created_bootstrap_admin ON auth.users;
DROP FUNCTION IF EXISTS public.bootstrap_first_admin();

CREATE TABLE public.admin_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  invited_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  accepted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX admin_invitations_email_idx ON public.admin_invitations (lower(email));
GRANT ALL ON public.admin_invitations TO service_role;
ALTER TABLE public.admin_invitations ENABLE ROW LEVEL SECURITY;

-- These role changes are called only by trusted server functions using the
-- service role. A transaction-level lock makes the first-admin claim atomic.
CREATE OR REPLACE FUNCTION public.claim_first_admin(_user_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(8416042);
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    RETURN false;
  END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (_user_id, 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.redeem_admin_invitation(
  _token_hash text,
  _user_id uuid,
  _email text
)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE invitation public.admin_invitations%ROWTYPE;
BEGIN
  SELECT * INTO invitation
  FROM public.admin_invitations
  WHERE token_hash = _token_hash
  FOR UPDATE;

  IF NOT FOUND OR invitation.accepted_at IS NOT NULL OR invitation.expires_at <= now()
     OR lower(invitation.email) <> lower(_email) THEN
    RETURN false;
  END IF;

  INSERT INTO public.user_roles (user_id, role) VALUES (_user_id, 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;
  UPDATE public.admin_invitations
  SET accepted_at = now(), accepted_by = _user_id
  WHERE id = invitation.id;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_first_admin(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.redeem_admin_invitation(text, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_first_admin(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.redeem_admin_invitation(text, uuid, text) TO service_role;
