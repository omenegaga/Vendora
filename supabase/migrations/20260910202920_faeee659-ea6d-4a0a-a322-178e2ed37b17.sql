ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS default_currency text NOT NULL DEFAULT 'NGN';
UPDATE public.settings SET default_currency = 'NGN' WHERE id = true;