-- ============================================================
-- Payment Credentials Keyring (mirrors shipping_credentials_keyring)
-- ============================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.payment_credentials_keyring (
  id          int PRIMARY KEY DEFAULT 1,
  key         bytea NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payment_keyring_singleton CHECK (id = 1)
);
INSERT INTO public.payment_credentials_keyring (id, key)
VALUES (1, gen_random_bytes(32))
ON CONFLICT (id) DO NOTHING;

REVOKE ALL ON public.payment_credentials_keyring FROM PUBLIC;
REVOKE ALL ON public.payment_credentials_keyring FROM anon, authenticated;
GRANT  ALL ON public.payment_credentials_keyring TO service_role;
ALTER TABLE public.payment_credentials_keyring ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Extra columns on payment_gateways
-- ============================================================
ALTER TABLE public.payment_gateways
  ADD COLUMN IF NOT EXISTS credentials_encrypted     bytea,
  ADD COLUMN IF NOT EXISTS credentials_fingerprint   text,
  ADD COLUMN IF NOT EXISTS credentials_set_at        timestamptz,
  ADD COLUMN IF NOT EXISTS credentials_set_by        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS webhook_secret_encrypted  bytea,
  ADD COLUMN IF NOT EXISTS last_test_at              timestamptz,
  ADD COLUMN IF NOT EXISTS last_test_ok              boolean,
  ADD COLUMN IF NOT EXISTS last_test_error           text;

-- Block authenticated from reading sensitive columns.
-- (Existing grant gave them SELECT on the whole table; we revoke it and
--  re-grant only the safe columns.)
REVOKE SELECT, INSERT, UPDATE ON public.payment_gateways FROM authenticated;

GRANT SELECT (
  id, store_id, adapter, display_name, is_active, priority,
  supported_methods, supported_currencies, capabilities, config,
  webhook_secret_ref, credentials_fingerprint, credentials_set_at,
  credentials_set_by, last_test_at, last_test_ok, last_test_error,
  created_by, created_at, updated_at
) ON public.payment_gateways TO authenticated;

GRANT INSERT (
  store_id, adapter, display_name, is_active, priority,
  supported_methods, supported_currencies, capabilities, config,
  webhook_secret_ref, created_by
) ON public.payment_gateways TO authenticated;

GRANT UPDATE (
  display_name, is_active, priority, supported_methods,
  supported_currencies, capabilities, config, webhook_secret_ref,
  last_test_at, last_test_ok, last_test_error
) ON public.payment_gateways TO authenticated;

GRANT DELETE ON public.payment_gateways TO authenticated;

-- ============================================================
-- RPCs: credenciais (encrypt / decrypt)
-- ============================================================
CREATE OR REPLACE FUNCTION public.payment_set_credentials(
  _gateway_id uuid,
  _creds      jsonb
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_store uuid; v_key bytea; v_text text;
BEGIN
  SELECT store_id INTO v_store FROM public.payment_gateways WHERE id = _gateway_id;
  IF v_store IS NULL THEN
    RAISE EXCEPTION 'Payment gateway não encontrado' USING ERRCODE = 'P0002';
  END IF;
  IF NOT (
    public.is_super_admin(auth.uid())
    OR public.has_permission(auth.uid(), 'payments.audit', v_store)
  ) THEN
    RAISE EXCEPTION 'Permissão negada: payments.audit' USING ERRCODE = '42501';
  END IF;
  IF _creds IS NULL OR jsonb_typeof(_creds) <> 'object' THEN
    RAISE EXCEPTION 'Credenciais inválidas (esperado objeto JSON)' USING ERRCODE = '22023';
  END IF;
  SELECT key INTO v_key FROM public.payment_credentials_keyring WHERE id = 1;
  v_text := _creds::text;
  UPDATE public.payment_gateways
     SET credentials_encrypted   = pgp_sym_encrypt(v_text, encode(v_key, 'hex')),
         credentials_fingerprint = encode(digest(v_text, 'sha256'), 'hex'),
         credentials_set_at      = now(),
         credentials_set_by      = auth.uid(),
         updated_at              = now()
   WHERE id = _gateway_id;
END $$;

REVOKE ALL ON FUNCTION public.payment_set_credentials(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.payment_set_credentials(uuid, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.payment_get_credentials(_gateway_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_key bytea; v_enc bytea; v_text text;
BEGIN
  SELECT k.key, g.credentials_encrypted
    INTO v_key, v_enc
    FROM public.payment_credentials_keyring k
    CROSS JOIN public.payment_gateways g
   WHERE k.id = 1 AND g.id = _gateway_id;
  IF v_enc IS NULL THEN RETURN NULL; END IF;
  v_text := pgp_sym_decrypt(v_enc, encode(v_key, 'hex'));
  RETURN v_text::jsonb;
END $$;
-- Apenas service_role (servidor) pode decifrar.
REVOKE ALL ON FUNCTION public.payment_get_credentials(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.payment_get_credentials(uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.payment_get_credentials(uuid) TO service_role;

-- ============================================================
-- RPC: webhook secret (separado das credenciais de API)
-- ============================================================
CREATE OR REPLACE FUNCTION public.payment_set_webhook_secret(
  _gateway_id uuid, _secret text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_store uuid; v_key bytea;
BEGIN
  SELECT store_id INTO v_store FROM public.payment_gateways WHERE id = _gateway_id;
  IF v_store IS NULL THEN RAISE EXCEPTION 'Payment gateway não encontrado'; END IF;
  IF NOT (
    public.is_super_admin(auth.uid())
    OR public.has_permission(auth.uid(), 'payments.audit', v_store)
  ) THEN
    RAISE EXCEPTION 'Permissão negada: payments.audit' USING ERRCODE = '42501';
  END IF;
  IF _secret IS NULL OR length(_secret) = 0 THEN
    RAISE EXCEPTION 'Webhook secret vazio'; END IF;
  SELECT key INTO v_key FROM public.payment_credentials_keyring WHERE id = 1;
  UPDATE public.payment_gateways
     SET webhook_secret_encrypted = pgp_sym_encrypt(_secret, encode(v_key,'hex')),
         updated_at = now()
   WHERE id = _gateway_id;
END $$;
REVOKE ALL ON FUNCTION public.payment_set_webhook_secret(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.payment_set_webhook_secret(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.payment_get_webhook_secret(_gateway_id uuid)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_key bytea; v_enc bytea;
BEGIN
  SELECT k.key, g.webhook_secret_encrypted INTO v_key, v_enc
    FROM public.payment_credentials_keyring k
    CROSS JOIN public.payment_gateways g
   WHERE k.id = 1 AND g.id = _gateway_id;
  IF v_enc IS NULL THEN RETURN NULL; END IF;
  RETURN pgp_sym_decrypt(v_enc, encode(v_key, 'hex'));
END $$;
REVOKE ALL ON FUNCTION public.payment_get_webhook_secret(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.payment_get_webhook_secret(uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.payment_get_webhook_secret(uuid) TO service_role;
