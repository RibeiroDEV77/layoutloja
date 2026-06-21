
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN
  CREATE TYPE public.fiscal_document_type AS ENUM ('nfe','nfce','nfse','cte');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE public.fiscal_invoice_status AS ENUM (
    'pending','processing','authorized','denied','cancelled','corrected','error'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE public.fiscal_environment AS ENUM ('production','sandbox');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.fiscal_credentials_keyring (
  id         int PRIMARY KEY DEFAULT 1,
  key        bytea NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fiscal_keyring_singleton CHECK (id = 1)
);
INSERT INTO public.fiscal_credentials_keyring (id, key)
VALUES (1, gen_random_bytes(32)) ON CONFLICT DO NOTHING;
REVOKE ALL ON public.fiscal_credentials_keyring FROM PUBLIC;
REVOKE ALL ON public.fiscal_credentials_keyring FROM anon, authenticated;
GRANT  ALL ON public.fiscal_credentials_keyring TO service_role;
ALTER TABLE public.fiscal_credentials_keyring ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.fiscal_providers (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id                  uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  adapter                   text NOT NULL,
  display_name              text NOT NULL,
  environment               public.fiscal_environment NOT NULL DEFAULT 'sandbox',
  is_active                 boolean NOT NULL DEFAULT true,
  priority                  int NOT NULL DEFAULT 100,
  supported_documents       text[] NOT NULL DEFAULT ARRAY['nfe']::text[],
  capabilities              jsonb NOT NULL DEFAULT '{}'::jsonb,
  config                    jsonb NOT NULL DEFAULT '{}'::jsonb,
  credentials_encrypted     bytea,
  credentials_fingerprint   text,
  credentials_set_at        timestamptz,
  credentials_set_by        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  webhook_secret_encrypted  bytea,
  last_test_at              timestamptz,
  last_test_ok              boolean,
  last_test_error           text,
  created_by                uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, adapter, environment)
);
CREATE INDEX IF NOT EXISTS fiscal_providers_store_active_idx
  ON public.fiscal_providers (store_id, is_active, priority);
GRANT SELECT (
  id, store_id, adapter, display_name, environment, is_active, priority,
  supported_documents, capabilities, config, credentials_fingerprint,
  credentials_set_at, credentials_set_by, last_test_at, last_test_ok,
  last_test_error, created_by, created_at, updated_at
) ON public.fiscal_providers TO authenticated;
GRANT INSERT (
  store_id, adapter, display_name, environment, is_active, priority,
  supported_documents, capabilities, config, created_by
) ON public.fiscal_providers TO authenticated;
GRANT UPDATE (
  display_name, is_active, priority, supported_documents, capabilities,
  config, last_test_at, last_test_ok, last_test_error
) ON public.fiscal_providers TO authenticated;
GRANT DELETE ON public.fiscal_providers TO authenticated;
GRANT ALL ON public.fiscal_providers TO service_role;
ALTER TABLE public.fiscal_providers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fiscal_providers_read" ON public.fiscal_providers
  FOR SELECT TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR public.has_permission(auth.uid(), 'fiscal.view',   store_id)
    OR public.has_permission(auth.uid(), 'fiscal.issue',  store_id)
    OR public.has_permission(auth.uid(), 'fiscal.cancel', store_id)
    OR public.has_permission(auth.uid(), 'fiscal.audit',  store_id)
  );
CREATE POLICY "fiscal_providers_write_audit" ON public.fiscal_providers
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid())
      OR public.has_permission(auth.uid(), 'fiscal.audit', store_id))
  WITH CHECK (public.is_super_admin(auth.uid())
      OR public.has_permission(auth.uid(), 'fiscal.audit', store_id));

CREATE TABLE IF NOT EXISTS public.fiscal_invoices (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id          uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  order_id          uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  provider_id       uuid NOT NULL REFERENCES public.fiscal_providers(id) ON DELETE RESTRICT,
  document_type     public.fiscal_document_type NOT NULL DEFAULT 'nfe',
  status            public.fiscal_invoice_status NOT NULL DEFAULT 'pending',
  series            text,
  number            text,
  access_key        text,
  external_id       text,
  protocol          text,
  issue_date        timestamptz,
  total_amount      numeric(14,2),
  rejection_code    text,
  rejection_reason  text,
  xml_url           text,
  danfe_url         text,
  cancel_protocol   text,
  cancelled_at      timestamptz,
  correction_text   text,
  corrected_at      timestamptz,
  idempotency_key   text,
  payload           jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata          jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS fiscal_invoices_store_status_idx
  ON public.fiscal_invoices (store_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS fiscal_invoices_order_idx
  ON public.fiscal_invoices (order_id);
CREATE INDEX IF NOT EXISTS fiscal_invoices_access_key_idx
  ON public.fiscal_invoices (access_key) WHERE access_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS fiscal_invoices_external_idx
  ON public.fiscal_invoices (provider_id, external_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fiscal_invoices TO authenticated;
GRANT ALL ON public.fiscal_invoices TO service_role;
ALTER TABLE public.fiscal_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fiscal_invoices_read" ON public.fiscal_invoices
  FOR SELECT TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR public.has_permission(auth.uid(), 'fiscal.view',   store_id)
    OR public.has_permission(auth.uid(), 'fiscal.issue',  store_id)
    OR public.has_permission(auth.uid(), 'fiscal.cancel', store_id)
    OR public.has_permission(auth.uid(), 'fiscal.audit',  store_id)
  );
CREATE POLICY "fiscal_invoices_insert" ON public.fiscal_invoices
  FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin(auth.uid())
           OR public.has_permission(auth.uid(), 'fiscal.issue', store_id));
CREATE POLICY "fiscal_invoices_update" ON public.fiscal_invoices
  FOR UPDATE TO authenticated
  USING (public.is_super_admin(auth.uid())
       OR public.has_permission(auth.uid(), 'fiscal.issue',  store_id)
       OR public.has_permission(auth.uid(), 'fiscal.cancel', store_id));
CREATE POLICY "fiscal_invoices_delete_audit" ON public.fiscal_invoices
  FOR DELETE TO authenticated
  USING (public.is_super_admin(auth.uid())
       OR public.has_permission(auth.uid(), 'fiscal.audit', store_id));

CREATE TABLE IF NOT EXISTS public.fiscal_invoice_events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id    uuid NOT NULL REFERENCES public.fiscal_invoices(id) ON DELETE CASCADE,
  store_id      uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  event_type    text NOT NULL,
  status        public.fiscal_invoice_status,
  message       text,
  payload       jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS fiscal_invoice_events_invoice_idx
  ON public.fiscal_invoice_events (invoice_id, created_at DESC);
GRANT SELECT, INSERT ON public.fiscal_invoice_events TO authenticated;
GRANT ALL ON public.fiscal_invoice_events TO service_role;
ALTER TABLE public.fiscal_invoice_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fiscal_invoice_events_read" ON public.fiscal_invoice_events
  FOR SELECT TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR public.has_permission(auth.uid(), 'fiscal.view',   store_id)
    OR public.has_permission(auth.uid(), 'fiscal.issue',  store_id)
    OR public.has_permission(auth.uid(), 'fiscal.cancel', store_id)
    OR public.has_permission(auth.uid(), 'fiscal.audit',  store_id)
  );
CREATE POLICY "fiscal_invoice_events_insert" ON public.fiscal_invoice_events
  FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin(auth.uid())
           OR public.has_permission(auth.uid(), 'fiscal.issue', store_id)
           OR public.has_permission(auth.uid(), 'fiscal.cancel', store_id));

CREATE TABLE IF NOT EXISTS public.fiscal_webhook_inbox (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id         uuid REFERENCES public.fiscal_providers(id) ON DELETE SET NULL,
  store_id            uuid REFERENCES public.stores(id) ON DELETE SET NULL,
  provider_code       text NOT NULL,
  external_event_id   text,
  event_type          text,
  signature_header    text,
  signature_valid     boolean,
  status              text NOT NULL DEFAULT 'received',
  raw_headers         jsonb NOT NULL DEFAULT '{}'::jsonb,
  raw_body            text  NOT NULL,
  processed_at        timestamptz,
  error_message       text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider_code, external_event_id)
);
CREATE INDEX IF NOT EXISTS fiscal_webhook_inbox_status_idx
  ON public.fiscal_webhook_inbox (status, created_at DESC);
REVOKE ALL ON public.fiscal_webhook_inbox FROM PUBLIC;
REVOKE ALL ON public.fiscal_webhook_inbox FROM anon, authenticated;
GRANT SELECT ON public.fiscal_webhook_inbox TO authenticated;
GRANT ALL ON public.fiscal_webhook_inbox TO service_role;
ALTER TABLE public.fiscal_webhook_inbox ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fiscal_webhook_inbox_read" ON public.fiscal_webhook_inbox
  FOR SELECT TO authenticated
  USING (
    store_id IS NULL
    OR public.is_super_admin(auth.uid())
    OR public.has_permission(auth.uid(), 'fiscal.audit', store_id)
  );

CREATE TRIGGER fiscal_providers_updated_at
  BEFORE UPDATE ON public.fiscal_providers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER fiscal_invoices_updated_at
  BEFORE UPDATE ON public.fiscal_invoices
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.permissions (code, module, description) VALUES
  ('fiscal.view',   'fiscal', 'Visualizar notas fiscais'),
  ('fiscal.issue',  'fiscal', 'Emitir notas fiscais'),
  ('fiscal.cancel', 'fiscal', 'Cancelar / corrigir notas fiscais'),
  ('fiscal.audit',  'fiscal', 'Configurar provedores fiscais e credenciais')
ON CONFLICT (code) DO NOTHING;

CREATE OR REPLACE FUNCTION public.fiscal_set_credentials(_provider_id uuid, _creds jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_store uuid; v_key bytea; v_text text;
BEGIN
  SELECT store_id INTO v_store FROM public.fiscal_providers WHERE id=_provider_id;
  IF v_store IS NULL THEN RAISE EXCEPTION 'Provedor fiscal não encontrado' USING ERRCODE='P0002'; END IF;
  IF NOT (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(),'fiscal.audit',v_store)) THEN
    RAISE EXCEPTION 'Permissão negada: fiscal.audit' USING ERRCODE='42501';
  END IF;
  IF _creds IS NULL OR jsonb_typeof(_creds) <> 'object' THEN
    RAISE EXCEPTION 'Credenciais inválidas' USING ERRCODE='22023';
  END IF;
  SELECT key INTO v_key FROM public.fiscal_credentials_keyring WHERE id=1;
  v_text := _creds::text;
  UPDATE public.fiscal_providers SET
    credentials_encrypted   = pgp_sym_encrypt(v_text, encode(v_key,'hex')),
    credentials_fingerprint = encode(digest(v_text,'sha256'),'hex'),
    credentials_set_at      = now(),
    credentials_set_by      = auth.uid(),
    updated_at              = now()
  WHERE id=_provider_id;
END $$;
REVOKE ALL ON FUNCTION public.fiscal_set_credentials(uuid,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fiscal_set_credentials(uuid,jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.fiscal_get_credentials(_provider_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_key bytea; v_enc bytea;
BEGIN
  SELECT k.key, p.credentials_encrypted INTO v_key, v_enc
    FROM public.fiscal_credentials_keyring k
    CROSS JOIN public.fiscal_providers p
   WHERE k.id=1 AND p.id=_provider_id;
  IF v_enc IS NULL THEN RETURN NULL; END IF;
  RETURN pgp_sym_decrypt(v_enc, encode(v_key,'hex'))::jsonb;
END $$;
REVOKE ALL ON FUNCTION public.fiscal_get_credentials(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fiscal_get_credentials(uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fiscal_get_credentials(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.fiscal_set_webhook_secret(_provider_id uuid, _secret text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_store uuid; v_key bytea;
BEGIN
  SELECT store_id INTO v_store FROM public.fiscal_providers WHERE id=_provider_id;
  IF v_store IS NULL THEN RAISE EXCEPTION 'Provedor fiscal não encontrado'; END IF;
  IF NOT (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(),'fiscal.audit',v_store)) THEN
    RAISE EXCEPTION 'Permissão negada: fiscal.audit' USING ERRCODE='42501';
  END IF;
  IF _secret IS NULL OR length(_secret)=0 THEN RAISE EXCEPTION 'Webhook secret vazio'; END IF;
  SELECT key INTO v_key FROM public.fiscal_credentials_keyring WHERE id=1;
  UPDATE public.fiscal_providers SET
    webhook_secret_encrypted = pgp_sym_encrypt(_secret, encode(v_key,'hex')),
    updated_at = now()
  WHERE id=_provider_id;
END $$;
REVOKE ALL ON FUNCTION public.fiscal_set_webhook_secret(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fiscal_set_webhook_secret(uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.fiscal_get_webhook_secret(_provider_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_key bytea; v_enc bytea;
BEGIN
  SELECT k.key, p.webhook_secret_encrypted INTO v_key, v_enc
    FROM public.fiscal_credentials_keyring k
    CROSS JOIN public.fiscal_providers p
   WHERE k.id=1 AND p.id=_provider_id;
  IF v_enc IS NULL THEN RETURN NULL; END IF;
  RETURN pgp_sym_decrypt(v_enc, encode(v_key,'hex'));
END $$;
REVOKE ALL ON FUNCTION public.fiscal_get_webhook_secret(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fiscal_get_webhook_secret(uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fiscal_get_webhook_secret(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.fiscal_record_issuance(
  _store_id uuid, _provider_id uuid, _order_id uuid,
  _document_type public.fiscal_document_type,
  _idempotency_key text, _payload jsonb DEFAULT '{}'::jsonb
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(),'fiscal.issue',_store_id)) THEN
    RAISE EXCEPTION 'Permissão negada: fiscal.issue' USING ERRCODE='42501';
  END IF;
  SELECT id INTO v_id FROM public.fiscal_invoices
   WHERE store_id=_store_id AND idempotency_key=_idempotency_key;
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;
  INSERT INTO public.fiscal_invoices (
    store_id, order_id, provider_id, document_type, status,
    idempotency_key, payload, created_by
  ) VALUES (
    _store_id, _order_id, _provider_id, _document_type, 'pending',
    _idempotency_key, COALESCE(_payload,'{}'::jsonb), auth.uid()
  ) RETURNING id INTO v_id;
  INSERT INTO public.fiscal_invoice_events (invoice_id, store_id, event_type, status, payload, created_by)
  VALUES (v_id, _store_id, 'issuance.requested', 'pending', _payload, auth.uid());
  PERFORM public.enqueue_outbox_event(
    _store_id, 'fiscal_invoice', v_id, 'invoice.issued',
    jsonb_build_object('invoice_id', v_id, 'order_id', _order_id, 'document_type', _document_type),
    jsonb_build_object('provider_id', _provider_id), NULL, NULL, false
  );
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.fiscal_record_issuance(uuid,uuid,uuid,public.fiscal_document_type,text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fiscal_record_issuance(uuid,uuid,uuid,public.fiscal_document_type,text,jsonb) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.fiscal_update_status(
  _invoice_id uuid, _status public.fiscal_invoice_status,
  _patch jsonb DEFAULT '{}'::jsonb, _message text DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_store uuid; v_event text;
BEGIN
  SELECT store_id INTO v_store FROM public.fiscal_invoices WHERE id=_invoice_id;
  IF v_store IS NULL THEN RAISE EXCEPTION 'Invoice não encontrada'; END IF;
  UPDATE public.fiscal_invoices SET
    status            = _status,
    series            = COALESCE(_patch->>'series', series),
    number            = COALESCE(_patch->>'number', number),
    access_key        = COALESCE(_patch->>'access_key', access_key),
    external_id       = COALESCE(_patch->>'external_id', external_id),
    protocol          = COALESCE(_patch->>'protocol', protocol),
    issue_date        = COALESCE(NULLIF(_patch->>'issue_date','')::timestamptz, issue_date),
    total_amount      = COALESCE(NULLIF(_patch->>'total_amount','')::numeric, total_amount),
    rejection_code    = COALESCE(_patch->>'rejection_code', rejection_code),
    rejection_reason  = COALESCE(_patch->>'rejection_reason', rejection_reason),
    xml_url           = COALESCE(_patch->>'xml_url', xml_url),
    danfe_url         = COALESCE(_patch->>'danfe_url', danfe_url),
    metadata          = metadata || COALESCE(_patch->'metadata','{}'::jsonb),
    updated_at        = now()
  WHERE id=_invoice_id;
  INSERT INTO public.fiscal_invoice_events (invoice_id, store_id, event_type, status, message, payload)
  VALUES (_invoice_id, v_store, 'status.changed', _status, _message, COALESCE(_patch,'{}'::jsonb));
  v_event := CASE _status
    WHEN 'authorized' THEN 'invoice.authorized'
    WHEN 'denied'     THEN 'invoice.denied'
    WHEN 'error'      THEN 'invoice.error'
    WHEN 'cancelled'  THEN 'invoice.cancelled'
    WHEN 'corrected'  THEN 'invoice.corrected'
    ELSE NULL END;
  IF v_event IS NOT NULL THEN
    PERFORM public.enqueue_outbox_event(
      v_store, 'fiscal_invoice', _invoice_id, v_event,
      jsonb_build_object('invoice_id', _invoice_id, 'status', _status, 'patch', _patch),
      '{}'::jsonb, NULL, NULL, false
    );
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.fiscal_update_status(uuid,public.fiscal_invoice_status,jsonb,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fiscal_update_status(uuid,public.fiscal_invoice_status,jsonb,text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.fiscal_record_cancellation(
  _invoice_id uuid, _protocol text, _reason text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_store uuid;
BEGIN
  SELECT store_id INTO v_store FROM public.fiscal_invoices WHERE id=_invoice_id;
  IF v_store IS NULL THEN RAISE EXCEPTION 'Invoice não encontrada'; END IF;
  IF NOT (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(),'fiscal.cancel',v_store)) THEN
    RAISE EXCEPTION 'Permissão negada: fiscal.cancel' USING ERRCODE='42501';
  END IF;
  UPDATE public.fiscal_invoices SET
    status='cancelled', cancel_protocol=_protocol, cancelled_at=now(), updated_at=now()
  WHERE id=_invoice_id;
  INSERT INTO public.fiscal_invoice_events (invoice_id, store_id, event_type, status, message, payload, created_by)
  VALUES (_invoice_id, v_store, 'cancellation', 'cancelled', _reason,
          jsonb_build_object('protocol', _protocol, 'reason', _reason), auth.uid());
  PERFORM public.enqueue_outbox_event(
    v_store, 'fiscal_invoice', _invoice_id, 'invoice.cancelled',
    jsonb_build_object('invoice_id', _invoice_id, 'protocol', _protocol, 'reason', _reason),
    '{}'::jsonb, NULL, NULL, false
  );
END $$;
REVOKE ALL ON FUNCTION public.fiscal_record_cancellation(uuid,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fiscal_record_cancellation(uuid,text,text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.fiscal_record_correction(
  _invoice_id uuid, _text text, _protocol text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_store uuid;
BEGIN
  SELECT store_id INTO v_store FROM public.fiscal_invoices WHERE id=_invoice_id;
  IF v_store IS NULL THEN RAISE EXCEPTION 'Invoice não encontrada'; END IF;
  IF NOT (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(),'fiscal.cancel',v_store)) THEN
    RAISE EXCEPTION 'Permissão negada: fiscal.cancel' USING ERRCODE='42501';
  END IF;
  UPDATE public.fiscal_invoices SET
    status='corrected', correction_text=_text, corrected_at=now(), updated_at=now()
  WHERE id=_invoice_id;
  INSERT INTO public.fiscal_invoice_events (invoice_id, store_id, event_type, status, message, payload, created_by)
  VALUES (_invoice_id, v_store, 'correction', 'corrected', _text,
          jsonb_build_object('protocol', _protocol, 'text', _text), auth.uid());
  PERFORM public.enqueue_outbox_event(
    v_store, 'fiscal_invoice', _invoice_id, 'invoice.corrected',
    jsonb_build_object('invoice_id', _invoice_id, 'protocol', _protocol, 'text', _text),
    '{}'::jsonb, NULL, NULL, false
  );
END $$;
REVOKE ALL ON FUNCTION public.fiscal_record_correction(uuid,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fiscal_record_correction(uuid,text,text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.fiscal_webhook_ingest(
  _provider_code text, _provider_id uuid, _external_event_id text,
  _event_type text, _signature_header text, _signature_valid boolean,
  _headers jsonb, _body text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid; v_store uuid;
BEGIN
  SELECT store_id INTO v_store FROM public.fiscal_providers WHERE id=_provider_id;
  INSERT INTO public.fiscal_webhook_inbox (
    provider_id, store_id, provider_code, external_event_id, event_type,
    signature_header, signature_valid, raw_headers, raw_body, status
  ) VALUES (
    _provider_id, v_store, _provider_code, _external_event_id, _event_type,
    _signature_header, _signature_valid, COALESCE(_headers,'{}'::jsonb), _body,
    CASE WHEN _signature_valid IS FALSE THEN 'failed' ELSE 'received' END
  )
  ON CONFLICT (provider_code, external_event_id) DO UPDATE SET status='duplicate'
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.fiscal_webhook_ingest(text,uuid,text,text,text,boolean,jsonb,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fiscal_webhook_ingest(text,uuid,text,text,text,boolean,jsonb,text) TO service_role;

CREATE OR REPLACE FUNCTION public.fiscal_webhook_mark_processed(
  _inbox_id uuid, _ok boolean, _error text DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.fiscal_webhook_inbox SET
    status = CASE WHEN _ok THEN 'processed' ELSE 'failed' END,
    processed_at = now(),
    error_message = _error
  WHERE id = _inbox_id;
END $$;
REVOKE ALL ON FUNCTION public.fiscal_webhook_mark_processed(uuid,boolean,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fiscal_webhook_mark_processed(uuid,boolean,text) TO service_role;
