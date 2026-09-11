-- Explicit, server-controlled payment lifecycle states.
ALTER TABLE public.orders
  ADD COLUMN payment_failure_reason text,
  ADD COLUMN failed_at timestamptz,
  ADD COLUMN cancelled_at timestamptz,
  ADD COLUMN expired_at timestamptz,
  ADD COLUMN abandoned_at timestamptz,
  ADD CONSTRAINT orders_payment_status_check
    CHECK (status IN ('pending', 'paid', 'failed', 'cancelled', 'expired', 'abandoned'));

CREATE INDEX orders_pending_created_at_idx ON public.orders (created_at)
  WHERE status = 'pending';
CREATE INDEX orders_meta_capi_retry_idx ON public.orders (meta_capi_next_retry_at)
  WHERE status = 'paid' AND meta_capi_sent_at IS NULL;

-- A signed provider webhook can be delivered more than once. Only the first
-- verified delivery may claim an event key.
CREATE TABLE public.payment_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL CHECK (provider IN ('paystack', 'flutterwave')),
  event_key text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  UNIQUE (provider, event_key)
);
GRANT ALL ON public.payment_webhook_events TO service_role;
REVOKE ALL ON public.payment_webhook_events FROM anon, authenticated;
ALTER TABLE public.payment_webhook_events ENABLE ROW LEVEL SECURITY;

-- Atomic, database-backed limits for public actions. The key is hashed in the
-- application, so no download tokens or client IP addresses are stored here.
CREATE TABLE public.public_rate_limits (
  key_hash text PRIMARY KEY,
  window_started_at timestamptz NOT NULL DEFAULT now(),
  request_count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.public_rate_limits TO service_role;
REVOKE ALL ON public.public_rate_limits FROM anon, authenticated;
ALTER TABLE public.public_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.consume_public_rate_limit(
  p_key_hash text,
  p_max_requests integer,
  p_window_seconds integer
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  allowed boolean := false;
BEGIN
  INSERT INTO public.public_rate_limits (key_hash, window_started_at, request_count)
  VALUES (p_key_hash, now(), 1)
  ON CONFLICT (key_hash) DO UPDATE
  SET
    window_started_at = CASE
      WHEN public.public_rate_limits.window_started_at <= now() - make_interval(secs => p_window_seconds)
      THEN now() ELSE public.public_rate_limits.window_started_at END,
    request_count = CASE
      WHEN public.public_rate_limits.window_started_at <= now() - make_interval(secs => p_window_seconds)
      THEN 1 ELSE public.public_rate_limits.request_count + 1 END,
    updated_at = now()
  WHERE public.public_rate_limits.window_started_at <= now() - make_interval(secs => p_window_seconds)
     OR public.public_rate_limits.request_count < p_max_requests
  RETURNING true INTO allowed;
  RETURN COALESCE(allowed, false);
END;
$$;
REVOKE ALL ON FUNCTION public.consume_public_rate_limit(text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_public_rate_limit(text, integer, integer) TO service_role;
