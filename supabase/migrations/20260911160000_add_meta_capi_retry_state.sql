-- Bounded, observable retries for transient Meta CAPI failures. These fields
-- hold delivery state only; no credentials or buyer data are duplicated.
ALTER TABLE public.orders
  ADD COLUMN meta_capi_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN meta_capi_last_attempt_at timestamptz,
  ADD COLUMN meta_capi_next_retry_at timestamptz,
  ADD COLUMN meta_capi_last_error text;
