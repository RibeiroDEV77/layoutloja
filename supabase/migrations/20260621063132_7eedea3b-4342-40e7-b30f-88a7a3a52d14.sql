-- Keyring tables store provider credentials and must never be reachable via the Data API.
-- service_role bypasses RLS; we add an explicit deny-all policy so the linter recognizes
-- the intent and the table is unreachable for anon/authenticated.

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['fiscal_credentials_keyring','payment_credentials_keyring','shipping_credentials_keyring']
  LOOP
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
    EXECUTE format($p$CREATE POLICY "Deny all access to %1$s" ON public.%1$I AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false)$p$, t);
  END LOOP;
END $$;