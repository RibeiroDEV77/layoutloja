
-- 1) Keyring interno (acesso somente service_role)
CREATE TABLE IF NOT EXISTS public.shipping_credentials_keyring (
  id          int PRIMARY KEY DEFAULT 1,
  key         bytea NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT shipping_keyring_singleton CHECK (id = 1)
);
INSERT INTO public.shipping_credentials_keyring (id, key)
VALUES (1, gen_random_bytes(32))
ON CONFLICT (id) DO NOTHING;

REVOKE ALL ON public.shipping_credentials_keyring FROM PUBLIC;
REVOKE ALL ON public.shipping_credentials_keyring FROM anon, authenticated;
GRANT ALL ON public.shipping_credentials_keyring TO service_role;
ALTER TABLE public.shipping_credentials_keyring ENABLE ROW LEVEL SECURITY;
-- sem policies: somente service_role bypassa RLS

-- 2) Contas de transportadora
CREATE TABLE IF NOT EXISTS public.shipping_carrier_accounts (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id                 uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  provider_code            text NOT NULL,             -- 'correios', 'melhor_envio', ...
  display_name             text NOT NULL,
  is_active                boolean NOT NULL DEFAULT true,
  sandbox                  boolean NOT NULL DEFAULT true,
  config                   jsonb NOT NULL DEFAULT '{}'::jsonb,        -- não-secreto
  capabilities             jsonb NOT NULL DEFAULT '{}'::jsonb,
  credentials_encrypted    bytea,
  credentials_fingerprint  text,
  credentials_set_at       timestamptz,
  credentials_set_by       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  last_test_at             timestamptz,
  last_test_ok             boolean,
  last_test_error          text,
  created_by               uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT shipping_carrier_accounts_unique UNIQUE (store_id, provider_code, display_name)
);

CREATE INDEX IF NOT EXISTS idx_shipping_carrier_accounts_store_active
  ON public.shipping_carrier_accounts (store_id, provider_code, is_active);

-- GRANTs por coluna: authenticated nunca lê/escreve credentials_encrypted diretamente
GRANT SELECT
  (id, store_id, provider_code, display_name, is_active, sandbox, config, capabilities,
   credentials_fingerprint, credentials_set_at, credentials_set_by,
   last_test_at, last_test_ok, last_test_error,
   created_by, created_at, updated_at)
  ON public.shipping_carrier_accounts TO authenticated;

GRANT INSERT
  (store_id, provider_code, display_name, is_active, sandbox, config, capabilities, created_by)
  ON public.shipping_carrier_accounts TO authenticated;

GRANT UPDATE
  (display_name, is_active, sandbox, config, capabilities)
  ON public.shipping_carrier_accounts TO authenticated;

GRANT DELETE ON public.shipping_carrier_accounts TO authenticated;
GRANT ALL ON public.shipping_carrier_accounts TO service_role;

ALTER TABLE public.shipping_carrier_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "carrier_accounts_read" ON public.shipping_carrier_accounts
FOR SELECT TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR public.has_permission(auth.uid(), 'shipping.manage', store_id)
);

CREATE POLICY "carrier_accounts_write" ON public.shipping_carrier_accounts
FOR ALL TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR public.has_permission(auth.uid(), 'shipping.manage', store_id)
)
WITH CHECK (
  public.is_super_admin(auth.uid())
  OR public.has_permission(auth.uid(), 'shipping.manage', store_id)
);

CREATE TRIGGER trg_shipping_carrier_accounts_updated_at
  BEFORE UPDATE ON public.shipping_carrier_accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3) RPCs de credenciais

CREATE OR REPLACE FUNCTION public.shipping_set_credentials(
  _account_id uuid,
  _creds      jsonb
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_store uuid;
  v_key   bytea;
  v_text  text;
BEGIN
  SELECT store_id INTO v_store
    FROM public.shipping_carrier_accounts
   WHERE id = _account_id;
  IF v_store IS NULL THEN
    RAISE EXCEPTION 'Conta de transportadora não encontrada' USING ERRCODE = 'P0002';
  END IF;
  IF NOT (
    public.is_super_admin(auth.uid())
    OR public.has_permission(auth.uid(), 'shipping.manage', v_store)
  ) THEN
    RAISE EXCEPTION 'Permissão negada: shipping.manage' USING ERRCODE = '42501';
  END IF;
  IF _creds IS NULL OR jsonb_typeof(_creds) <> 'object' THEN
    RAISE EXCEPTION 'Credenciais inválidas (esperado objeto JSON)' USING ERRCODE = '22023';
  END IF;

  SELECT key INTO v_key FROM public.shipping_credentials_keyring WHERE id = 1;
  v_text := _creds::text;

  UPDATE public.shipping_carrier_accounts
     SET credentials_encrypted   = pgp_sym_encrypt(v_text, encode(v_key, 'hex')),
         credentials_fingerprint = encode(digest(v_text, 'sha256'), 'hex'),
         credentials_set_at      = now(),
         credentials_set_by      = auth.uid(),
         updated_at              = now()
   WHERE id = _account_id;
END $$;

REVOKE ALL ON FUNCTION public.shipping_set_credentials(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.shipping_set_credentials(uuid, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.shipping_get_credentials(_account_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_key  bytea;
  v_enc  bytea;
  v_text text;
BEGIN
  -- Plaintext só para backend confiável (service_role).
  IF current_user NOT IN ('service_role', 'postgres') THEN
    RAISE EXCEPTION 'Permissão negada' USING ERRCODE = '42501';
  END IF;
  SELECT credentials_encrypted INTO v_enc
    FROM public.shipping_carrier_accounts
   WHERE id = _account_id;
  IF v_enc IS NULL THEN RETURN NULL; END IF;
  SELECT key INTO v_key FROM public.shipping_credentials_keyring WHERE id = 1;
  v_text := pgp_sym_decrypt(v_enc, encode(v_key, 'hex'));
  RETURN v_text::jsonb;
END $$;

REVOKE ALL ON FUNCTION public.shipping_get_credentials(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.shipping_get_credentials(uuid) TO service_role;

-- 4) Outbox emit
CREATE OR REPLACE FUNCTION public.tg_shipping_carrier_accounts_outbox()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_event   text;
  v_payload jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_event := 'shipping.carrier_account.created';
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
      v_event := CASE WHEN NEW.is_active
                      THEN 'shipping.carrier_account.activated'
                      ELSE 'shipping.carrier_account.deactivated' END;
    ELSIF NEW.credentials_fingerprint IS DISTINCT FROM OLD.credentials_fingerprint THEN
      v_event := 'shipping.carrier_account.credentials_rotated';
    ELSE
      v_event := 'shipping.carrier_account.updated';
    END IF;
  ELSE
    v_event := 'shipping.carrier_account.deleted';
  END IF;

  v_payload := jsonb_build_object(
    'account_id',     COALESCE(NEW.id, OLD.id),
    'provider_code',  COALESCE(NEW.provider_code, OLD.provider_code),
    'display_name',   COALESCE(NEW.display_name, OLD.display_name),
    'is_active',      COALESCE(NEW.is_active, OLD.is_active),
    'sandbox',        COALESCE(NEW.sandbox, OLD.sandbox)
  );

  PERFORM public.enqueue_outbox_event(
    COALESCE(NEW.store_id, OLD.store_id),
    'shipping_carrier_account',
    COALESCE(NEW.id, OLD.id),
    v_event,
    v_payload,
    jsonb_build_object('schema_version', 1),
    NULL, NULL, true
  );

  RETURN COALESCE(NEW, OLD);
END $$;

CREATE TRIGGER trg_shipping_carrier_accounts_outbox
AFTER INSERT OR UPDATE OR DELETE ON public.shipping_carrier_accounts
FOR EACH ROW EXECUTE FUNCTION public.tg_shipping_carrier_accounts_outbox();
