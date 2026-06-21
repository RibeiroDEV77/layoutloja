-- ============================================================
-- FASE 5.1+ — Refinamentos do Customer Hub (corrigida)
-- ============================================================

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS score int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS score_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS internal_notes text,
  ADD COLUMN IF NOT EXISTS consent_marketing_email boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS consent_marketing_sms boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS consent_marketing_whatsapp boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS consent_data_processing boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS consent_updated_at timestamptz;

ALTER TABLE public.customer_addresses
  ADD COLUMN IF NOT EXISTS latitude numeric(10,7),
  ADD COLUMN IF NOT EXISTS longitude numeric(10,7),
  ADD COLUMN IF NOT EXISTS geocoded_at timestamptz,
  ADD COLUMN IF NOT EXISTS geocode_provider text,
  ADD COLUMN IF NOT EXISTS geocode_precision text
    CHECK (geocode_precision IS NULL OR geocode_precision IN ('rooftop','interpolated','approximate','city'));

-- Tags
CREATE TABLE IF NOT EXISTS public.customer_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  color text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, slug)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_tags TO authenticated;
GRANT ALL ON public.customer_tags TO service_role;
ALTER TABLE public.customer_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tags_select" ON public.customer_tags FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(), 'customers.read', store_id));
CREATE POLICY "tags_write" ON public.customer_tags FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(), 'customers.update', store_id))
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(), 'customers.update', store_id));
CREATE TRIGGER trg_customer_tags_updated BEFORE UPDATE ON public.customer_tags
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.customer_tag_map (
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES public.customer_tags(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (customer_id, tag_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_tag_map TO authenticated;
GRANT ALL ON public.customer_tag_map TO service_role;
ALTER TABLE public.customer_tag_map ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tag_map_select" ON public.customer_tag_map FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(), 'customers.read', public.customer_store_id(customer_id)));
CREATE POLICY "tag_map_write" ON public.customer_tag_map FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(), 'customers.update', public.customer_store_id(customer_id)))
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(), 'customers.update', public.customer_store_id(customer_id)));

-- Notas
CREATE TABLE IF NOT EXISTS public.customer_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  author_user_id uuid,
  body text NOT NULL,
  pinned boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_notes TO authenticated;
GRANT ALL ON public.customer_notes TO service_role;
ALTER TABLE public.customer_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notes_select" ON public.customer_notes FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(), 'customers.read', public.customer_store_id(customer_id)));
CREATE POLICY "notes_write" ON public.customer_notes FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(), 'customers.update', public.customer_store_id(customer_id)))
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(), 'customers.update', public.customer_store_id(customer_id)));
CREATE TRIGGER trg_customer_notes_updated BEFORE UPDATE ON public.customer_notes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX IF NOT EXISTS idx_customer_notes_customer ON public.customer_notes(customer_id, created_at DESC);

-- Consentimentos
CREATE TABLE IF NOT EXISTS public.customer_consents_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('marketing_email','marketing_sms','marketing_whatsapp','data_processing')),
  granted boolean NOT NULL,
  source text,
  ip text,
  user_agent text,
  actor_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.customer_consents_log TO authenticated;
GRANT ALL ON public.customer_consents_log TO service_role;
ALTER TABLE public.customer_consents_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "consents_select" ON public.customer_consents_log FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(), 'customers.read', public.customer_store_id(customer_id)));
CREATE POLICY "consents_insert" ON public.customer_consents_log FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(), 'customers.update', public.customer_store_id(customer_id)));
CREATE INDEX IF NOT EXISTS idx_consents_log_customer ON public.customer_consents_log(customer_id, created_at DESC);

-- Score factors
CREATE TABLE IF NOT EXISTS public.customer_score_factors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  factor_code text NOT NULL,
  value numeric NOT NULL DEFAULT 0,
  weight numeric NOT NULL DEFAULT 1,
  computed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (customer_id, factor_code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_score_factors TO authenticated;
GRANT ALL ON public.customer_score_factors TO service_role;
ALTER TABLE public.customer_score_factors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "score_factors_select" ON public.customer_score_factors FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(), 'customers.read', public.customer_store_id(customer_id)));
CREATE POLICY "score_factors_write" ON public.customer_score_factors FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(), 'customers.update', public.customer_store_id(customer_id)))
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(), 'customers.update', public.customer_store_id(customer_id)));

-- Score function
CREATE OR REPLACE FUNCTION public.recompute_customer_score(_customer_id uuid)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_score int := 0;
  v_customer public.customers%ROWTYPE;
  v_has_address boolean;
  v_credit_balance numeric;
BEGIN
  SELECT * INTO v_customer FROM public.customers WHERE id = _customer_id;
  IF NOT FOUND THEN RETURN 0; END IF;

  DELETE FROM public.customer_score_factors WHERE customer_id = _customer_id;

  SELECT EXISTS(SELECT 1 FROM public.customer_addresses WHERE customer_id = _customer_id
    AND postal_code IS NOT NULL AND street IS NOT NULL AND city IS NOT NULL) INTO v_has_address;
  IF v_has_address THEN
    v_score := v_score + 10;
    INSERT INTO public.customer_score_factors(customer_id, factor_code, value, weight)
      VALUES (_customer_id, 'has_address', 10, 1);
  END IF;

  IF v_customer.email IS NOT NULL AND v_customer.phone IS NOT NULL THEN
    v_score := v_score + 10;
    INSERT INTO public.customer_score_factors(customer_id, factor_code, value, weight)
      VALUES (_customer_id, 'has_email_and_phone', 10, 1);
  END IF;

  IF v_customer.consent_marketing_email OR v_customer.consent_marketing_sms OR v_customer.consent_marketing_whatsapp THEN
    v_score := v_score + 15;
    INSERT INTO public.customer_score_factors(customer_id, factor_code, value, weight)
      VALUES (_customer_id, 'marketing_consent', 15, 1);
  END IF;

  IF v_customer.segment::text = 'vip' THEN
    v_score := v_score + 10;
    INSERT INTO public.customer_score_factors(customer_id, factor_code, value, weight)
      VALUES (_customer_id, 'vip_segment', 10, 1);
  END IF;

  IF v_customer.status::text = 'blocked' THEN
    v_score := v_score - 30;
    INSERT INTO public.customer_score_factors(customer_id, factor_code, value, weight)
      VALUES (_customer_id, 'blocked', -30, 1);
  END IF;

  SELECT COALESCE(SUM(CASE WHEN kind::text IN ('grant','refund','adjustment_add') THEN amount
                           WHEN kind::text IN ('consume','adjustment_sub','expire') THEN -amount
                           ELSE 0 END), 0)
    INTO v_credit_balance
    FROM public.customer_credit_ledger WHERE customer_id = _customer_id;
  IF v_credit_balance < 0 THEN
    v_score := v_score - 20;
    INSERT INTO public.customer_score_factors(customer_id, factor_code, value, weight)
      VALUES (_customer_id, 'negative_credit', -20, 1);
  END IF;

  UPDATE public.customers SET score = v_score, score_updated_at = now() WHERE id = _customer_id;
  RETURN v_score;
END $$;

-- Timeline view
CREATE OR REPLACE VIEW public.customer_timeline_view AS
SELECT
  de.aggregate_id AS customer_id,
  de.id AS event_id,
  'domain_event'::text AS source,
  de.event_type AS kind,
  de.payload AS data,
  de.actor_user_id,
  de.created_at AS occurred_at
FROM public.domain_events de
WHERE de.aggregate_type = 'customer'
UNION ALL
SELECT
  cl.customer_id,
  cl.id AS event_id,
  'credit_ledger'::text AS source,
  cl.kind::text,
  jsonb_build_object('amount', cl.amount, 'balance_after', cl.balance_after, 'reason', cl.reason),
  cl.actor_user_id,
  cl.created_at AS occurred_at
FROM public.customer_credit_ledger cl
UNION ALL
SELECT
  cn.customer_id,
  cn.id AS event_id,
  'note'::text AS source,
  CASE WHEN cn.pinned THEN 'note_pinned' ELSE 'note' END,
  jsonb_build_object('body', cn.body, 'pinned', cn.pinned),
  cn.author_user_id,
  cn.created_at AS occurred_at
FROM public.customer_notes cn
UNION ALL
SELECT
  ccl.customer_id,
  ccl.id AS event_id,
  'consent'::text AS source,
  ('consent_' || ccl.channel || '_' || CASE WHEN ccl.granted THEN 'granted' ELSE 'revoked' END),
  jsonb_build_object('channel', ccl.channel, 'granted', ccl.granted, 'source', ccl.source),
  ccl.actor_user_id,
  ccl.created_at
FROM public.customer_consents_log ccl
UNION ALL
SELECT
  al.entity_id AS customer_id,
  al.id AS event_id,
  'audit'::text AS source,
  (al.entity_type || '.' || al.action),
  COALESCE(al.diff, '{}'::jsonb),
  al.actor_user_id,
  al.created_at
FROM public.audit_log al
WHERE al.entity_type = 'customers';

GRANT SELECT ON public.customer_timeline_view TO authenticated;
GRANT ALL ON public.customer_timeline_view TO service_role;

INSERT INTO public.feature_flags (key, name, description, enabled, default_value)
VALUES ('customers.enable_geocoding', 'Geocoding de endereços', 'Habilita geocodificação automática quando provider configurado', false, 'false'::jsonb)
ON CONFLICT (key) DO NOTHING;