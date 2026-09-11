-- Payment status is controlled solely by verified server-side gateway flows.
-- Admins retain read access but cannot use the public Supabase API to mark an
-- order paid or otherwise alter its status.
DROP POLICY IF EXISTS "admins update orders" ON public.orders;
