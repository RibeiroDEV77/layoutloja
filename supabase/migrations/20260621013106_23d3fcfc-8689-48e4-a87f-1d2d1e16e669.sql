
-- ============================================================
-- MIGRATION 1/3 — ORDER ENGINE CORE AGGREGATE (Phase 5.3 v1.1)
-- ============================================================

-- ===== ENUMS =====
DO $$ BEGIN
  CREATE TYPE public.order_status AS ENUM (
    'draft','pending_payment','authorized','paid','on_hold',
    'awaiting_fulfillment','partially_fulfilled','fulfilled',
    'awaiting_shipment','partially_shipped','shipped','delivered',
    'completed','cancelled','refunded','partially_refunded','returned'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.order_item_type AS ENUM (
    'physical','digital','service','bundle','shipping','fee','discount'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.order_address_kind AS ENUM ('billing','shipping');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.order_timeline_event AS ENUM (
    'created','status_changed','hold_added','hold_released',
    'payment_authorized','payment_captured','payment_failed','payment_refunded',
    'fulfillment_created','fulfillment_completed','shipment_dispatched','shipment_delivered',
    'return_requested','return_completed','note_added','document_generated',
    'tag_added','tag_removed','assigned','rule_applied','system'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.order_ledger_kind AS ENUM (
    'charge','capture','refund','chargeback','adjustment_credit','adjustment_debit','fee'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ===== ORDERS =====
CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE RESTRICT,
  order_number text NOT NULL,
  status public.order_status NOT NULL DEFAULT 'draft',
  channel text NOT NULL DEFAULT 'web',
  source_cart_id uuid REFERENCES public.carts(id) ON DELETE SET NULL,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_email text,
  customer_phone text,
  currency text NOT NULL DEFAULT 'BRL',
  subtotal numeric(14,2) NOT NULL DEFAULT 0,
  discount_total numeric(14,2) NOT NULL DEFAULT 0,
  shipping_total numeric(14,2) NOT NULL DEFAULT 0,
  tax_total numeric(14,2) NOT NULL DEFAULT 0,
  fees_total numeric(14,2) NOT NULL DEFAULT 0,
  total numeric(14,2) NOT NULL DEFAULT 0,
  items_count integer NOT NULL DEFAULT 0,
  version integer NOT NULL DEFAULT 1,
  correlation_id uuid,
  causation_id uuid,
  idempotency_key text,
  tags text[] NOT NULL DEFAULT '{}',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  placed_at timestamptz,
  closed_at timestamptz,
  cancelled_at timestamptz,
  cancellation_reason text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT orders_total_nonneg CHECK (total >= 0),
  CONSTRAINT orders_items_nonneg CHECK (items_count >= 0),
  CONSTRAINT orders_version_pos CHECK (version >= 1)
);
CREATE UNIQUE INDEX orders_store_number_uk ON public.orders(store_id, order_number);
CREATE INDEX orders_store_status_idx ON public.orders(store_id, status);
CREATE INDEX orders_customer_idx ON public.orders(customer_id) WHERE customer_id IS NOT NULL;
CREATE INDEX orders_placed_at_brin ON public.orders USING BRIN (placed_at);
CREATE INDEX orders_created_at_brin ON public.orders USING BRIN (created_at);
CREATE INDEX orders_tags_gin ON public.orders USING GIN (tags);
CREATE INDEX orders_metadata_gin ON public.orders USING GIN (metadata);
CREATE INDEX orders_correlation_idx ON public.orders(correlation_id) WHERE correlation_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;

-- ===== ORDER ITEMS =====
CREATE TABLE public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  store_id uuid NOT NULL,
  item_type public.order_item_type NOT NULL DEFAULT 'physical',
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  variant_id uuid REFERENCES public.product_variants(id) ON DELETE SET NULL,
  sku text,
  name text NOT NULL,
  qty numeric(14,3) NOT NULL DEFAULT 1,
  list_price numeric(14,2) NOT NULL DEFAULT 0,
  unit_price numeric(14,2) NOT NULL DEFAULT 0,
  discount_amount numeric(14,2) NOT NULL DEFAULT 0,
  tax_amount numeric(14,2) NOT NULL DEFAULT 0,
  line_total numeric(14,2) NOT NULL DEFAULT 0,
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT order_items_qty_pos CHECK (qty > 0)
);
CREATE INDEX order_items_order_idx ON public.order_items(order_id);
CREATE INDEX order_items_variant_idx ON public.order_items(variant_id) WHERE variant_id IS NOT NULL;
CREATE INDEX order_items_sku_idx ON public.order_items(store_id, sku) WHERE sku IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_items TO authenticated;
GRANT ALL ON public.order_items TO service_role;

-- ===== ORDER ADDRESSES =====
CREATE TABLE public.order_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  store_id uuid NOT NULL,
  kind public.order_address_kind NOT NULL,
  recipient text,
  doc_number text,
  phone text,
  email text,
  postal_code text,
  street text,
  number text,
  complement text,
  district text,
  city text,
  state text,
  country text NOT NULL DEFAULT 'BR',
  reference text,
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX order_addresses_order_idx ON public.order_addresses(order_id, kind);
CREATE INDEX order_addresses_postal_idx ON public.order_addresses(postal_code) WHERE postal_code IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_addresses TO authenticated;
GRANT ALL ON public.order_addresses TO service_role;

-- ===== SNAPSHOTS =====
CREATE TABLE public.order_pricing_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  store_id uuid NOT NULL,
  snapshot jsonb NOT NULL,
  hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX order_pricing_snapshots_order_uk ON public.order_pricing_snapshots(order_id);
GRANT SELECT, INSERT ON public.order_pricing_snapshots TO authenticated;
GRANT ALL ON public.order_pricing_snapshots TO service_role;

CREATE TABLE public.order_shipping_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  store_id uuid NOT NULL,
  carrier text,
  service text,
  price numeric(14,2),
  eta_days integer,
  snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX order_shipping_snapshots_order_uk ON public.order_shipping_snapshots(order_id);
GRANT SELECT, INSERT ON public.order_shipping_snapshots TO authenticated;
GRANT ALL ON public.order_shipping_snapshots TO service_role;

CREATE TABLE public.order_coupon_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  store_id uuid NOT NULL,
  coupon_id uuid,
  coupon_code text NOT NULL,
  applied_value numeric(14,2) NOT NULL DEFAULT 0,
  snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX order_coupon_snapshots_order_idx ON public.order_coupon_snapshots(order_id);
GRANT SELECT, INSERT ON public.order_coupon_snapshots TO authenticated;
GRANT ALL ON public.order_coupon_snapshots TO service_role;

CREATE TABLE public.order_tax_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  store_id uuid NOT NULL,
  total_tax numeric(14,2) NOT NULL DEFAULT 0,
  breakdown jsonb NOT NULL DEFAULT '[]'::jsonb,
  snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX order_tax_snapshots_order_uk ON public.order_tax_snapshots(order_id);
GRANT SELECT, INSERT ON public.order_tax_snapshots TO authenticated;
GRANT ALL ON public.order_tax_snapshots TO service_role;

CREATE TABLE public.order_customer_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  store_id uuid NOT NULL,
  customer_id uuid,
  snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX order_customer_snapshots_order_uk ON public.order_customer_snapshots(order_id);
GRANT SELECT, INSERT ON public.order_customer_snapshots TO authenticated;
GRANT ALL ON public.order_customer_snapshots TO service_role;

-- ===== TIMELINE =====
CREATE TABLE public.order_timeline (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  store_id uuid NOT NULL,
  event_type public.order_timeline_event NOT NULL,
  actor_user_id uuid,
  actor_label text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  correlation_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX order_timeline_order_idx ON public.order_timeline(order_id, created_at DESC);
CREATE INDEX order_timeline_store_event_idx ON public.order_timeline(store_id, event_type);
CREATE INDEX order_timeline_created_brin ON public.order_timeline USING BRIN (created_at);

GRANT SELECT, INSERT ON public.order_timeline TO authenticated;
GRANT ALL ON public.order_timeline TO service_role;

-- ===== LEDGER =====
CREATE TABLE public.order_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  store_id uuid NOT NULL,
  kind public.order_ledger_kind NOT NULL,
  amount numeric(14,2) NOT NULL,
  currency text NOT NULL DEFAULT 'BRL',
  balance_after numeric(14,2),
  reference_type text,
  reference_id uuid,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX order_ledger_order_idx ON public.order_ledger(order_id, created_at);
CREATE INDEX order_ledger_store_kind_idx ON public.order_ledger(store_id, kind);
CREATE INDEX order_ledger_created_brin ON public.order_ledger USING BRIN (created_at);

GRANT SELECT, INSERT ON public.order_ledger TO authenticated;
GRANT ALL ON public.order_ledger TO service_role;

-- ===== AUDIT =====
CREATE TABLE public.order_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  store_id uuid NOT NULL,
  entity text NOT NULL,
  entity_id uuid,
  action text NOT NULL,
  actor_user_id uuid,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX order_audit_order_idx ON public.order_audit(order_id, created_at DESC);
CREATE INDEX order_audit_entity_idx ON public.order_audit(entity, entity_id);
CREATE INDEX order_audit_created_brin ON public.order_audit USING BRIN (created_at);

GRANT SELECT, INSERT ON public.order_audit TO authenticated;
GRANT ALL ON public.order_audit TO service_role;

-- ===== HELPERS =====
CREATE OR REPLACE FUNCTION public.order_store_id(_order_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT store_id FROM public.orders WHERE id = _order_id
$$;

CREATE TRIGGER trg_orders_updated_at BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_order_items_updated_at BEFORE UPDATE ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.bump_order_version()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN NEW.version := OLD.version + 1; END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_orders_version BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.bump_order_version();

CREATE OR REPLACE FUNCTION public.order_audit_row_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_order_id uuid; v_store_id uuid;
  v_entity text := TG_TABLE_NAME;
  v_entity_id uuid; v_action text := lower(TG_OP);
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_entity_id := (to_jsonb(OLD)->>'id')::uuid;
    v_store_id := (to_jsonb(OLD)->>'store_id')::uuid;
    v_order_id := COALESCE((to_jsonb(OLD)->>'order_id')::uuid, (to_jsonb(OLD)->>'id')::uuid);
  ELSE
    v_entity_id := (to_jsonb(NEW)->>'id')::uuid;
    v_store_id := (to_jsonb(NEW)->>'store_id')::uuid;
    v_order_id := COALESCE((to_jsonb(NEW)->>'order_id')::uuid, (to_jsonb(NEW)->>'id')::uuid);
  END IF;
  INSERT INTO public.order_audit(order_id, store_id, entity, entity_id, action, actor_user_id, old_data, new_data)
  VALUES (v_order_id, v_store_id, v_entity, v_entity_id, v_action, auth.uid(),
    CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN to_jsonb(OLD) END,
    CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN to_jsonb(NEW) END);
  RETURN COALESCE(NEW, OLD);
END $$;

CREATE TRIGGER trg_orders_audit AFTER INSERT OR UPDATE OR DELETE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.order_audit_row_change();
CREATE TRIGGER trg_order_items_audit AFTER INSERT OR UPDATE OR DELETE ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION public.order_audit_row_change();
CREATE TRIGGER trg_order_addresses_audit AFTER INSERT OR UPDATE OR DELETE ON public.order_addresses
  FOR EACH ROW EXECUTE FUNCTION public.order_audit_row_change();

-- ===== RBAC SEED =====
INSERT INTO public.permissions (code, module, description) VALUES
  ('orders.read',     'orders', 'Leitura de pedidos e agregados'),
  ('orders.write',    'orders', 'Criar e atualizar pedidos'),
  ('orders.cancel',   'orders', 'Cancelar pedidos elegíveis'),
  ('orders.refund',   'orders', 'Iniciar reembolsos totais ou parciais'),
  ('orders.hold',     'orders', 'Aplicar e liberar bloqueios operacionais'),
  ('orders.assign',   'orders', 'Direcionar pedidos a operadores'),
  ('orders.tag',      'orders', 'Adicionar e remover tags de pedidos'),
  ('orders.note',     'orders', 'Criar notas internas em pedidos'),
  ('orders.document', 'orders', 'Gerar e baixar documentos de pedidos'),
  ('orders.fulfill',  'orders', 'Operar separação e preparação de pedidos'),
  ('orders.ship',     'orders', 'Despachar envios e atualizar rastreio'),
  ('orders.return',   'orders', 'Abrir e processar RMA'),
  ('orders.payment',  'orders', 'Capturar, estornar e alocar pagamentos'),
  ('orders.metrics',  'orders', 'Acessar dashboards e métricas de pedidos'),
  ('orders.export',   'orders', 'Exportar pedidos para arquivo')
ON CONFLICT (code) DO NOTHING;

-- ===== RLS =====
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_pricing_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_shipping_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_coupon_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_tax_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_customer_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_timeline ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "orders_read" ON public.orders FOR SELECT TO authenticated
USING (is_super_admin(auth.uid()) OR has_permission(auth.uid(), 'orders.read', store_id));
CREATE POLICY "orders_insert" ON public.orders FOR INSERT TO authenticated
WITH CHECK (is_super_admin(auth.uid()) OR has_permission(auth.uid(), 'orders.write', store_id));
CREATE POLICY "orders_update" ON public.orders FOR UPDATE TO authenticated
USING (is_super_admin(auth.uid()) OR has_permission(auth.uid(), 'orders.write', store_id))
WITH CHECK (is_super_admin(auth.uid()) OR has_permission(auth.uid(), 'orders.write', store_id));
CREATE POLICY "orders_delete" ON public.orders FOR DELETE TO authenticated
USING (is_super_admin(auth.uid()));

CREATE POLICY "order_items_read" ON public.order_items FOR SELECT TO authenticated
USING (is_super_admin(auth.uid()) OR has_permission(auth.uid(), 'orders.read', store_id));
CREATE POLICY "order_items_write" ON public.order_items FOR ALL TO authenticated
USING (is_super_admin(auth.uid()) OR has_permission(auth.uid(), 'orders.write', store_id))
WITH CHECK (is_super_admin(auth.uid()) OR has_permission(auth.uid(), 'orders.write', store_id));

CREATE POLICY "order_addresses_read" ON public.order_addresses FOR SELECT TO authenticated
USING (is_super_admin(auth.uid()) OR has_permission(auth.uid(), 'orders.read', store_id));
CREATE POLICY "order_addresses_write" ON public.order_addresses FOR ALL TO authenticated
USING (is_super_admin(auth.uid()) OR has_permission(auth.uid(), 'orders.write', store_id))
WITH CHECK (is_super_admin(auth.uid()) OR has_permission(auth.uid(), 'orders.write', store_id));

CREATE POLICY "order_pricing_snap_read" ON public.order_pricing_snapshots FOR SELECT TO authenticated
USING (is_super_admin(auth.uid()) OR has_permission(auth.uid(), 'orders.read', store_id));
CREATE POLICY "order_pricing_snap_insert" ON public.order_pricing_snapshots FOR INSERT TO authenticated
WITH CHECK (is_super_admin(auth.uid()) OR has_permission(auth.uid(), 'orders.write', store_id));

CREATE POLICY "order_shipping_snap_read" ON public.order_shipping_snapshots FOR SELECT TO authenticated
USING (is_super_admin(auth.uid()) OR has_permission(auth.uid(), 'orders.read', store_id));
CREATE POLICY "order_shipping_snap_insert" ON public.order_shipping_snapshots FOR INSERT TO authenticated
WITH CHECK (is_super_admin(auth.uid()) OR has_permission(auth.uid(), 'orders.write', store_id));

CREATE POLICY "order_coupon_snap_read" ON public.order_coupon_snapshots FOR SELECT TO authenticated
USING (is_super_admin(auth.uid()) OR has_permission(auth.uid(), 'orders.read', store_id));
CREATE POLICY "order_coupon_snap_insert" ON public.order_coupon_snapshots FOR INSERT TO authenticated
WITH CHECK (is_super_admin(auth.uid()) OR has_permission(auth.uid(), 'orders.write', store_id));

CREATE POLICY "order_tax_snap_read" ON public.order_tax_snapshots FOR SELECT TO authenticated
USING (is_super_admin(auth.uid()) OR has_permission(auth.uid(), 'orders.read', store_id));
CREATE POLICY "order_tax_snap_insert" ON public.order_tax_snapshots FOR INSERT TO authenticated
WITH CHECK (is_super_admin(auth.uid()) OR has_permission(auth.uid(), 'orders.write', store_id));

CREATE POLICY "order_customer_snap_read" ON public.order_customer_snapshots FOR SELECT TO authenticated
USING (is_super_admin(auth.uid()) OR has_permission(auth.uid(), 'orders.read', store_id));
CREATE POLICY "order_customer_snap_insert" ON public.order_customer_snapshots FOR INSERT TO authenticated
WITH CHECK (is_super_admin(auth.uid()) OR has_permission(auth.uid(), 'orders.write', store_id));

CREATE POLICY "order_timeline_read" ON public.order_timeline FOR SELECT TO authenticated
USING (is_super_admin(auth.uid()) OR has_permission(auth.uid(), 'orders.read', store_id));
CREATE POLICY "order_timeline_insert" ON public.order_timeline FOR INSERT TO authenticated
WITH CHECK (is_super_admin(auth.uid()) OR has_permission(auth.uid(), 'orders.write', store_id));

CREATE POLICY "order_ledger_read" ON public.order_ledger FOR SELECT TO authenticated
USING (is_super_admin(auth.uid()) OR has_permission(auth.uid(), 'orders.read', store_id));
CREATE POLICY "order_ledger_insert" ON public.order_ledger FOR INSERT TO authenticated
WITH CHECK (is_super_admin(auth.uid()) OR has_permission(auth.uid(), 'orders.payment', store_id));

CREATE POLICY "order_audit_read" ON public.order_audit FOR SELECT TO authenticated
USING (is_super_admin(auth.uid()) OR has_permission(auth.uid(), 'orders.read', store_id));
