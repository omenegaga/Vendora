-- Preserve custom store names while moving untouched installations to Vendora.
UPDATE public.settings
SET store_name = 'Vendora', email_sender_name = 'Vendora'
WHERE id = true
  AND store_name = 'My Digital Store'
  AND email_sender_name = 'My Digital Store';
