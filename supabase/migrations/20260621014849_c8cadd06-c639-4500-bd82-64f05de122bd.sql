
-- ============================================================
-- MIGRATION 3/3 — OMS WORKFLOW & INTEGRATION (Phase 5.3 v1.1)
-- ============================================================

-- ===== 1. SNAPSHOT VERSIONING =====
ALTER TABLE public.order_pricing_snapshots  ADD COLUMN IF NOT EXISTS schema_version smallint NOT NULL DEFAULT 1;
ALTER TABLE public.order_shipping_snapshots ADD COLUMN IF NOT EXISTS schema_version smallint NOT NULL DEFAULT 1;
ALTER TABLE public.order_coupon_snapshots   ADD COLUMN IF NOT EXISTS schema_version smallint NOT NULL DEFAULT 1;
ALTER TABLE public.order_tax_snapshots      ADD COLUMN IF NOT EXISTS schema_version smallint NOT NULL DEFAULT 1;
ALTER TABLE public.order_customer_snapshots ADD COLUMN IF NOT EXISTS schema_version smallint NOT NULL DEFAULT 1;

-- ===== 2. TRACE PROPAGATION on orders =====
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS trace_id text;
CREATE INDEX IF NOT EXISTS orders_trace_id_idx ON public.orders(trace_id) WHERE trace_id IS NOT NULL;

-- ===== 3. RBAC — workflow transition permission =====
INSERT INTO public.permissions (code, module, description) VALUES
  ('orders.transition', 'orders', 'Executar transições de workflow no pedido')
ON CONFLICT (code) DO NOTHING;

-- ===== 4. ORDER WORKFLOW SEEDER (per store) =====
CREATE OR REPLACE FUNCTION public.seed_order_workflow(_store_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_def_id uuid;
  v_state_ids jsonb := '{}'::jsonb;
  v_codes text[] := ARRAY[
    'draft','pending_payment','payment_authorized','paid','on_hold',
    'fraud_review','allocated','partially_fulfilled','fulfilled',
    'partially_shipped','shipped','delivered','partially_returned',
    'returned','cancelled','refunded','closed'
  ];
  v_initial text := 'draft';
  v_finals text[] := ARRAY['delivered','cancelled','refunded','closed'];
  c text; v_state_id uuid; v_idx int := 0;
BEGIN
  -- definição (idempotente por store + code + version)
  SELECT id INTO v_def_id FROM public.workflow_definitions
    WHERE store_id = _store_id AND code = 'order' AND version = 1;
  IF v_def_id IS NULL THEN
    INSERT INTO public.workflow_definitions (store_id, code, name, aggregate_type, version, description, is_active)
    VALUES (_store_id, 'order', 'Order Workflow', 'order', 1, 'Workflow oficial do Order Engine v1.1', true)
    RETURNING id INTO v_def_id;
  END IF;

  -- estados
  FOREACH c IN ARRAY v_codes LOOP
    v_idx := v_idx + 1;
    INSERT INTO public.workflow_states (definition_id, code, label, is_initial, is_final, sort_order)
    VALUES (v_def_id, c, initcap(replace(c,'_',' ')), c = v_initial, c = ANY(v_finals), v_idx)
    ON CONFLICT DO NOTHING;
    SELECT id INTO v_state_id FROM public.workflow_states WHERE definition_id = v_def_id AND code = c;
    v_state_ids := v_state_ids || jsonb_build_object(c, v_state_id);
  END LOOP;

  -- transições canônicas (idempotentes por (definition_id, code))
  PERFORM public._seed_order_transition(v_def_id, v_state_ids, 'submit',           'draft',                  'pending_payment');
  PERFORM public._seed_order_transition(v_def_id, v_state_ids, 'authorize',        'pending_payment',        'payment_authorized');
  PERFORM public._seed_order_transition(v_def_id, v_state_ids, 'capture',          'payment_authorized',     'paid');
  PERFORM public._seed_order_transition(v_def_id, v_state_ids, 'hold',             'paid',                   'on_hold');
  PERFORM public._seed_order_transition(v_def_id, v_state_ids, 'release_hold',     'on_hold',                'paid');
  PERFORM public._seed_order_transition(v_def_id, v_state_ids, 'flag_fraud',       'paid',                   'fraud_review');
  PERFORM public._seed_order_transition(v_def_id, v_state_ids, 'clear_fraud',      'fraud_review',           'paid');
  PERFORM public._seed_order_transition(v_def_id, v_state_ids, 'allocate',         'paid',                   'allocated');
  PERFORM public._seed_order_transition(v_def_id, v_state_ids, 'partial_fulfill',  'allocated',              'partially_fulfilled');
  PERFORM public._seed_order_transition(v_def_id, v_state_ids, 'fulfill',          'allocated',              'fulfilled');
  PERFORM public._seed_order_transition(v_def_id, v_state_ids, 'fulfill_from_partial','partially_fulfilled', 'fulfilled');
  PERFORM public._seed_order_transition(v_def_id, v_state_ids, 'partial_ship',     'fulfilled',              'partially_shipped');
  PERFORM public._seed_order_transition(v_def_id, v_state_ids, 'ship',             'fulfilled',              'shipped');
  PERFORM public._seed_order_transition(v_def_id, v_state_ids, 'ship_from_partial','partially_shipped',      'shipped');
  PERFORM public._seed_order_transition(v_def_id, v_state_ids, 'deliver',          'shipped',                'delivered');
  PERFORM public._seed_order_transition(v_def_id, v_state_ids, 'partial_return',   'delivered',              'partially_returned');
  PERFORM public._seed_order_transition(v_def_id, v_state_ids, 'return',           'delivered',              'returned');
  PERFORM public._seed_order_transition(v_def_id, v_state_ids, 'refund',           'returned',               'refunded');
  PERFORM public._seed_order_transition(v_def_id, v_state_ids, 'close',            'delivered',              'closed');
  PERFORM public._seed_order_transition(v_def_id, v_state_ids, 'cancel_draft',     'draft',                  'cancelled');
  PERFORM public._seed_order_transition(v_def_id, v_state_ids, 'cancel_pending',   'pending_payment',        'cancelled');
  PERFORM public._seed_order_transition(v_def_id, v_state_ids, 'cancel_paid',      'paid',                   'cancelled');
  PERFORM public._seed_order_transition(v_def_id, v_state_ids, 'cancel_on_hold',   'on_hold',                'cancelled');

  RETURN v_def_id;
END $$;

CREATE OR REPLACE FUNCTION public._seed_order_transition(
  _def_id uuid, _state_map jsonb, _code text, _from_code text, _to_code text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.workflow_transitions (definition_id, code, label, from_state_id, to_state_id, required_permission)
  VALUES (_def_id, _code, initcap(replace(_code,'_',' ')),
          (_state_map->>_from_code)::uuid, (_state_map->>_to_code)::uuid,
          'orders.transition')
  ON CONFLICT DO NOTHING;
END $$;

-- seed automático para todas as lojas existentes
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT id FROM public.stores LOOP
    PERFORM public.seed_order_workflow(r.id);
  END LOOP;
END $$;

-- ===== 5. ORDER WORKFLOW INSTANCES (vínculo 1:1 com pedido) =====
CREATE TABLE public.order_workflow_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  store_id uuid NOT NULL,
  instance_id uuid NOT NULL REFERENCES public.workflow_instances(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX order_workflow_instances_order_uk ON public.order_workflow_instances(order_id);
CREATE UNIQUE INDEX order_workflow_instances_instance_uk ON public.order_workflow_instances(instance_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_workflow_instances TO authenticated;
GRANT ALL ON public.order_workflow_instances TO service_role;
ALTER TABLE public.order_workflow_instances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owi_read" ON public.order_workflow_instances FOR SELECT TO authenticated
USING (is_super_admin(auth.uid()) OR has_permission(auth.uid(), 'orders.read', store_id));
CREATE POLICY "owi_write" ON public.order_workflow_instances FOR ALL TO authenticated
USING (is_super_admin(auth.uid()) OR has_permission(auth.uid(), 'orders.transition', store_id))
WITH CHECK (is_super_admin(auth.uid()) OR has_permission(auth.uid(), 'orders.transition', store_id));

-- ===== 6. ORDERS SEARCH PROJECTION =====
CREATE TABLE public.orders_search (
  order_id uuid PRIMARY KEY REFERENCES public.orders(id) ON DELETE CASCADE,
  store_id uuid NOT NULL,
  order_number text NOT NULL,
  status public.order_status NOT NULL,
  channel text,
  customer_id uuid,
  customer_name text,
  customer_email text,
  customer_phone text,
  total numeric(14,2) NOT NULL DEFAULT 0,
  items_count integer NOT NULL DEFAULT 0,
  tags text[] NOT NULL DEFAULT '{}',
  skus text[] NOT NULL DEFAULT '{}',
  placed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  search_tsv tsvector
);
CREATE INDEX orders_search_store_status_idx ON public.orders_search(store_id, status);
CREATE INDEX orders_search_store_placed_idx ON public.orders_search(store_id, placed_at DESC);
CREATE INDEX orders_search_tsv_idx ON public.orders_search USING gin(search_tsv);
CREATE INDEX orders_search_tags_idx ON public.orders_search USING gin(tags);
CREATE INDEX orders_search_skus_idx ON public.orders_search USING gin(skus);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders_search TO authenticated;
GRANT ALL ON public.orders_search TO service_role;
ALTER TABLE public.orders_search ENABLE ROW LEVEL SECURITY;
CREATE POLICY "osr_read" ON public.orders_search FOR SELECT TO authenticated
USING (is_super_admin(auth.uid()) OR has_permission(auth.uid(), 'orders.read', store_id));
CREATE POLICY "osr_service_write" ON public.orders_search FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.refresh_orders_search(_order_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_o public.orders%ROWTYPE;
  v_cust_name text; v_skus text[]; v_tsv tsvector;
BEGIN
  SELECT * INTO v_o FROM public.orders WHERE id = _order_id;
  IF NOT FOUND THEN
    DELETE FROM public.orders_search WHERE order_id = _order_id; RETURN;
  END IF;
  SELECT (s.snapshot->>'full_name') INTO v_cust_name
    FROM public.order_customer_snapshots s WHERE s.order_id = _order_id LIMIT 1;
  SELECT array_agg(DISTINCT sku) FILTER (WHERE sku IS NOT NULL) INTO v_skus
    FROM public.order_items WHERE order_id = _order_id;

  v_tsv := setweight(to_tsvector('simple', coalesce(v_o.order_number,'')), 'A')
        || setweight(to_tsvector('simple', coalesce(v_cust_name,'')), 'B')
        || setweight(to_tsvector('simple', coalesce(v_o.customer_email,'')), 'B')
        || setweight(to_tsvector('simple', coalesce(v_o.customer_phone,'')), 'C')
        || setweight(to_tsvector('simple', coalesce(array_to_string(v_o.tags,' '),'')), 'C')
        || setweight(to_tsvector('simple', coalesce(array_to_string(v_skus,' '),'')), 'D');

  INSERT INTO public.orders_search (order_id, store_id, order_number, status, channel, customer_id,
    customer_name, customer_email, customer_phone, total, items_count, tags, skus,
    placed_at, updated_at, search_tsv)
  VALUES (v_o.id, v_o.store_id, v_o.order_number, v_o.status, v_o.channel, v_o.customer_id,
    v_cust_name, v_o.customer_email, v_o.customer_phone, v_o.total, v_o.items_count,
    v_o.tags, coalesce(v_skus, '{}'::text[]), v_o.placed_at, now(), v_tsv)
  ON CONFLICT (order_id) DO UPDATE SET
    store_id = EXCLUDED.store_id, order_number = EXCLUDED.order_number, status = EXCLUDED.status,
    channel = EXCLUDED.channel, customer_id = EXCLUDED.customer_id,
    customer_name = EXCLUDED.customer_name, customer_email = EXCLUDED.customer_email,
    customer_phone = EXCLUDED.customer_phone, total = EXCLUDED.total,
    items_count = EXCLUDED.items_count, tags = EXCLUDED.tags, skus = EXCLUDED.skus,
    placed_at = EXCLUDED.placed_at, updated_at = now(), search_tsv = EXCLUDED.search_tsv;
END $$;

CREATE OR REPLACE FUNCTION public.tg_refresh_orders_search()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  v_id := COALESCE((to_jsonb(NEW)->>'order_id')::uuid, (to_jsonb(NEW)->>'id')::uuid,
                   (to_jsonb(OLD)->>'order_id')::uuid, (to_jsonb(OLD)->>'id')::uuid);
  IF v_id IS NOT NULL THEN PERFORM public.refresh_orders_search(v_id); END IF;
  RETURN COALESCE(NEW, OLD);
END $$;

CREATE TRIGGER trg_orders_search_orders
  AFTER INSERT OR UPDATE OR DELETE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.tg_refresh_orders_search();
CREATE TRIGGER trg_orders_search_items
  AFTER INSERT OR UPDATE OR DELETE ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION public.tg_refresh_orders_search();
CREATE TRIGGER trg_orders_search_customer
  AFTER INSERT OR UPDATE OR DELETE ON public.order_customer_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.tg_refresh_orders_search();

-- ===== 7. OUTBOX INTEGRATION =====
CREATE OR REPLACE FUNCTION public.tg_orders_enqueue_outbox()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_event text;
  v_payload jsonb;
  v_meta jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_event := 'order.created';
    v_payload := jsonb_build_object('order_id', NEW.id, 'order_number', NEW.order_number,
      'status', NEW.status, 'total', NEW.total, 'customer_id', NEW.customer_id);
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      v_event := 'order.status_changed';
      v_payload := jsonb_build_object('order_id', NEW.id, 'from', OLD.status, 'to', NEW.status,
        'version', NEW.version);
    ELSE
      RETURN NEW;
    END IF;
  ELSE
    RETURN OLD;
  END IF;

  v_meta := jsonb_build_object(
    'trace_id', NEW.trace_id,
    'correlation_id', NEW.correlation_id,
    'causation_id', NEW.causation_id,
    'schema_version', 1
  );

  PERFORM public.enqueue_outbox_event(
    NEW.store_id, 'order', NEW.id, v_event, v_payload, v_meta,
    NEW.correlation_id, NEW.causation_id, true  -- ordered por aggregate
  );
  RETURN NEW;
END $$;

CREATE TRIGGER trg_orders_outbox
  AFTER INSERT OR UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.tg_orders_enqueue_outbox();

-- ===== 8. MATERIALIZED VIEW: orders_daily =====
CREATE MATERIALIZED VIEW public.mv_orders_daily AS
SELECT
  o.store_id,
  date_trunc('day', COALESCE(o.placed_at, o.created_at))::date AS day,
  count(*) AS orders_count,
  count(*) FILTER (WHERE o.status NOT IN ('cancelled','refunded')) AS valid_orders_count,
  coalesce(sum(o.total) FILTER (WHERE o.status NOT IN ('cancelled','refunded')), 0)::numeric(14,2) AS gross_total,
  coalesce(sum(o.total) FILTER (WHERE o.status = 'refunded'), 0)::numeric(14,2) AS refunded_total,
  coalesce(sum(o.total) FILTER (WHERE o.status NOT IN ('cancelled','refunded','draft','pending_payment')), 0)::numeric(14,2) AS net_total
FROM public.orders o
GROUP BY 1, 2;

CREATE UNIQUE INDEX mv_orders_daily_uk ON public.mv_orders_daily(store_id, day);
CREATE INDEX mv_orders_daily_day_idx ON public.mv_orders_daily(day DESC);

CREATE OR REPLACE FUNCTION public.refresh_orders_daily()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_orders_daily;
$$;

-- view com RLS via wrapper para autenticados (apenas lojas com acesso)
CREATE OR REPLACE VIEW public.orders_daily_v WITH (security_invoker = true) AS
  SELECT * FROM public.mv_orders_daily
  WHERE is_super_admin(auth.uid()) OR has_permission(auth.uid(), 'orders.read', store_id);
GRANT SELECT ON public.orders_daily_v TO authenticated;
GRANT SELECT ON public.mv_orders_daily TO service_role;

-- ===== 9. OBSERVABILITY — LOCK CONTENTION =====
CREATE OR REPLACE FUNCTION public.record_order_lock_contention(
  _store_id uuid, _order_id uuid, _scope text, _reason text DEFAULT 'locked'
) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT public.record_metric('orders', 'lock.contention', 1, 'count',
    jsonb_build_object('scope', _scope, 'order_id', _order_id, 'reason', _reason),
    _store_id);
$$;
