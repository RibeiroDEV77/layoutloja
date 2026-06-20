-- =========================================================================
-- FASE 2.7 — DOMAIN EVENTS
-- =========================================================================

CREATE TABLE public.domain_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid REFERENCES public.stores(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  aggregate_type text NOT NULL,
  aggregate_id uuid,
  actor_user_id uuid,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','processed','failed','skipped')),
  error_message text,
  retry_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_domain_events_store ON public.domain_events(store_id);
CREATE INDEX idx_domain_events_type ON public.domain_events(event_type);
CREATE INDEX idx_domain_events_aggregate ON public.domain_events(aggregate_type, aggregate_id);
CREATE INDEX idx_domain_events_status ON public.domain_events(status) WHERE status IN ('pending','failed');
CREATE INDEX idx_domain_events_occurred ON public.domain_events(occurred_at DESC);

GRANT SELECT ON public.domain_events TO authenticated;
GRANT ALL ON public.domain_events TO service_role;
ALTER TABLE public.domain_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "domain_events read by store members"
  ON public.domain_events FOR SELECT TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR (store_id IS NOT NULL AND store_id IN (SELECT public.user_store_ids(auth.uid())))
  );

CREATE TABLE public.domain_event_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid REFERENCES public.stores(id) ON DELETE CASCADE,
  event_pattern text NOT NULL,
  channel text NOT NULL CHECK (channel IN ('webhook','email','whatsapp','internal','erp','marketplace')),
  target text NOT NULL,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_des_store ON public.domain_event_subscriptions(store_id);
CREATE INDEX idx_des_pattern ON public.domain_event_subscriptions(event_pattern) WHERE is_active = true;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.domain_event_subscriptions TO authenticated;
GRANT ALL ON public.domain_event_subscriptions TO service_role;
ALTER TABLE public.domain_event_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subscriptions managed by admins"
  ON public.domain_event_subscriptions FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(), 'settings.manage', store_id))
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(), 'settings.manage', store_id));

CREATE TRIGGER trg_des_updated BEFORE UPDATE ON public.domain_event_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.emit_domain_event(
  _event_type text, _aggregate_type text, _aggregate_id uuid,
  _store_id uuid, _payload jsonb DEFAULT '{}'::jsonb, _metadata jsonb DEFAULT '{}'::jsonb
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO public.domain_events (store_id, event_type, aggregate_type, aggregate_id, actor_user_id, payload, metadata)
  VALUES (_store_id, _event_type, _aggregate_type, _aggregate_id, auth.uid(), _payload, _metadata)
  RETURNING id INTO v_id;
  RETURN v_id;
END; $$;

-- =========================================================================
-- FASE 3 — OPERAÇÃO COMERCIAL
-- =========================================================================

CREATE TABLE public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  code text, legal_name text NOT NULL, trade_name text, tax_id text,
  email text, phone text, website text,
  address jsonb DEFAULT '{}'::jsonb,
  payment_terms text, lead_time_days int, notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, code)
);
CREATE INDEX idx_suppliers_store ON public.suppliers(store_id);
CREATE INDEX idx_suppliers_active ON public.suppliers(store_id) WHERE is_active = true;
CREATE INDEX idx_suppliers_legal_name ON public.suppliers(store_id, legal_name);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.suppliers TO authenticated;
GRANT ALL ON public.suppliers TO service_role;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "suppliers read" ON public.suppliers FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(),'suppliers.read',store_id));
CREATE POLICY "suppliers write" ON public.suppliers FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(),'suppliers.manage',store_id))
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(),'suppliers.manage',store_id));
CREATE TRIGGER trg_suppliers_updated BEFORE UPDATE ON public.suppliers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.supplier_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  name text NOT NULL, role text, email text, phone text,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_sc_supplier ON public.supplier_contacts(supplier_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.supplier_contacts TO authenticated;
GRANT ALL ON public.supplier_contacts TO service_role;
ALTER TABLE public.supplier_contacts ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.supplier_store_id(_supplier_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT store_id FROM public.suppliers WHERE id = _supplier_id
$$;
CREATE POLICY "sc read" ON public.supplier_contacts FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(),'suppliers.read',public.supplier_store_id(supplier_id)));
CREATE POLICY "sc write" ON public.supplier_contacts FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(),'suppliers.manage',public.supplier_store_id(supplier_id)))
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(),'suppliers.manage',public.supplier_store_id(supplier_id)));
CREATE TRIGGER trg_sc_updated BEFORE UPDATE ON public.supplier_contacts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.warehouses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  code text NOT NULL, name text NOT NULL,
  type text NOT NULL DEFAULT 'main' CHECK (type IN ('main','branch','virtual','consignment','transit')),
  address jsonb DEFAULT '{}'::jsonb,
  is_default boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, code)
);
CREATE INDEX idx_warehouses_store ON public.warehouses(store_id);
CREATE UNIQUE INDEX idx_warehouses_default ON public.warehouses(store_id) WHERE is_default = true;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.warehouses TO authenticated;
GRANT ALL ON public.warehouses TO service_role;
ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "warehouses read" ON public.warehouses FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(),'inventory.read',store_id));
CREATE POLICY "warehouses write" ON public.warehouses FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(),'inventory.manage',store_id))
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(),'inventory.manage',store_id));
CREATE TRIGGER trg_warehouses_updated BEFORE UPDATE ON public.warehouses FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.warehouse_store_id(_warehouse_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT store_id FROM public.warehouses WHERE id = _warehouse_id
$$;

CREATE TABLE public.stock_levels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  warehouse_id uuid NOT NULL REFERENCES public.warehouses(id) ON DELETE CASCADE,
  variant_id uuid NOT NULL REFERENCES public.product_variants(id) ON DELETE CASCADE,
  quantity_on_hand numeric(14,3) NOT NULL DEFAULT 0,
  quantity_reserved numeric(14,3) NOT NULL DEFAULT 0,
  quantity_incoming numeric(14,3) NOT NULL DEFAULT 0,
  reorder_point numeric(14,3), reorder_quantity numeric(14,3),
  last_movement_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (warehouse_id, variant_id)
);
CREATE INDEX idx_sl_store ON public.stock_levels(store_id);
CREATE INDEX idx_sl_variant ON public.stock_levels(variant_id);
CREATE INDEX idx_sl_low ON public.stock_levels(store_id) WHERE reorder_point IS NOT NULL AND quantity_on_hand <= reorder_point;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_levels TO authenticated;
GRANT ALL ON public.stock_levels TO service_role;
ALTER TABLE public.stock_levels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sl read" ON public.stock_levels FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(),'inventory.read',store_id));
CREATE POLICY "sl write" ON public.stock_levels FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(),'inventory.manage',store_id))
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(),'inventory.manage',store_id));
CREATE TRIGGER trg_sl_updated BEFORE UPDATE ON public.stock_levels FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  warehouse_id uuid NOT NULL REFERENCES public.warehouses(id) ON DELETE RESTRICT,
  variant_id uuid NOT NULL REFERENCES public.product_variants(id) ON DELETE RESTRICT,
  movement_type text NOT NULL CHECK (movement_type IN (
    'purchase_receipt','sale','sale_return','purchase_return',
    'adjustment_in','adjustment_out','transfer_in','transfer_out',
    'inventory_count','reservation','release','loss','production'
  )),
  quantity numeric(14,3) NOT NULL,
  unit_cost numeric(14,4),
  reference_type text, reference_id uuid,
  notes text, performed_by uuid,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_sm_store ON public.stock_movements(store_id);
CREATE INDEX idx_sm_variant ON public.stock_movements(variant_id, occurred_at DESC);
CREATE INDEX idx_sm_warehouse ON public.stock_movements(warehouse_id, occurred_at DESC);
CREATE INDEX idx_sm_reference ON public.stock_movements(reference_type, reference_id);
GRANT SELECT, INSERT ON public.stock_movements TO authenticated;
GRANT ALL ON public.stock_movements TO service_role;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sm read" ON public.stock_movements FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(),'inventory.read',store_id));
CREATE POLICY "sm insert" ON public.stock_movements FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(),'inventory.manage',store_id));

CREATE TABLE public.cost_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  variant_id uuid NOT NULL REFERENCES public.product_variants(id) ON DELETE CASCADE,
  cost_method text NOT NULL DEFAULT 'average' CHECK (cost_method IN ('average','fifo','lifo','standard','last')),
  unit_cost numeric(14,4) NOT NULL,
  previous_cost numeric(14,4),
  quantity_in numeric(14,3),
  reference_type text, reference_id uuid,
  effective_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ch_variant ON public.cost_history(variant_id, effective_at DESC);
CREATE INDEX idx_ch_store ON public.cost_history(store_id);
GRANT SELECT, INSERT ON public.cost_history TO authenticated;
GRANT ALL ON public.cost_history TO service_role;
ALTER TABLE public.cost_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ch read" ON public.cost_history FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(),'inventory.read',store_id));
CREATE POLICY "ch insert" ON public.cost_history FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(),'inventory.manage',store_id));

CREATE TABLE public.purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE RESTRICT,
  warehouse_id uuid REFERENCES public.warehouses(id) ON DELETE SET NULL,
  po_number text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','confirmed','partially_received','received','cancelled','closed')),
  order_date date NOT NULL DEFAULT CURRENT_DATE,
  expected_date date,
  currency text NOT NULL DEFAULT 'BRL',
  subtotal numeric(14,2) NOT NULL DEFAULT 0,
  discount_amount numeric(14,2) NOT NULL DEFAULT 0,
  shipping_cost numeric(14,2) NOT NULL DEFAULT 0,
  tax_amount numeric(14,2) NOT NULL DEFAULT 0,
  total_amount numeric(14,2) NOT NULL DEFAULT 0,
  payment_terms text, notes text,
  created_by uuid, approved_by uuid, approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, po_number)
);
CREATE INDEX idx_po_store ON public.purchase_orders(store_id);
CREATE INDEX idx_po_supplier ON public.purchase_orders(supplier_id);
CREATE INDEX idx_po_status ON public.purchase_orders(store_id, status);
CREATE INDEX idx_po_open ON public.purchase_orders(store_id) WHERE status IN ('sent','confirmed','partially_received');
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_orders TO authenticated;
GRANT ALL ON public.purchase_orders TO service_role;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "po read" ON public.purchase_orders FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(),'purchases.read',store_id));
CREATE POLICY "po write" ON public.purchase_orders FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(),'purchases.manage',store_id))
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(),'purchases.manage',store_id));
CREATE TRIGGER trg_po_updated BEFORE UPDATE ON public.purchase_orders FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.purchase_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id uuid NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  variant_id uuid NOT NULL REFERENCES public.product_variants(id) ON DELETE RESTRICT,
  quantity_ordered numeric(14,3) NOT NULL,
  quantity_received numeric(14,3) NOT NULL DEFAULT 0,
  unit_cost numeric(14,4) NOT NULL,
  discount_amount numeric(14,2) NOT NULL DEFAULT 0,
  tax_amount numeric(14,2) NOT NULL DEFAULT 0,
  total_amount numeric(14,2) NOT NULL DEFAULT 0,
  notes text, position int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_poi_po ON public.purchase_order_items(purchase_order_id);
CREATE INDEX idx_poi_variant ON public.purchase_order_items(variant_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_order_items TO authenticated;
GRANT ALL ON public.purchase_order_items TO service_role;
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.po_store_id(_po_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT store_id FROM public.purchase_orders WHERE id = _po_id
$$;
CREATE POLICY "poi read" ON public.purchase_order_items FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(),'purchases.read',public.po_store_id(purchase_order_id)));
CREATE POLICY "poi write" ON public.purchase_order_items FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(),'purchases.manage',public.po_store_id(purchase_order_id)))
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(),'purchases.manage',public.po_store_id(purchase_order_id)));
CREATE TRIGGER trg_poi_updated BEFORE UPDATE ON public.purchase_order_items FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.goods_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  purchase_order_id uuid REFERENCES public.purchase_orders(id) ON DELETE SET NULL,
  warehouse_id uuid NOT NULL REFERENCES public.warehouses(id) ON DELETE RESTRICT,
  receipt_number text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','confirmed','cancelled')),
  invoice_number text, invoice_date date,
  received_at timestamptz NOT NULL DEFAULT now(),
  received_by uuid, notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, receipt_number)
);
CREATE INDEX idx_gr_store ON public.goods_receipts(store_id);
CREATE INDEX idx_gr_po ON public.goods_receipts(purchase_order_id);
CREATE INDEX idx_gr_warehouse ON public.goods_receipts(warehouse_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.goods_receipts TO authenticated;
GRANT ALL ON public.goods_receipts TO service_role;
ALTER TABLE public.goods_receipts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gr read" ON public.goods_receipts FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(),'purchases.read',store_id));
CREATE POLICY "gr write" ON public.goods_receipts FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(),'purchases.manage',store_id))
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(),'purchases.manage',store_id));
CREATE TRIGGER trg_gr_updated BEFORE UPDATE ON public.goods_receipts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.goods_receipt_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  goods_receipt_id uuid NOT NULL REFERENCES public.goods_receipts(id) ON DELETE CASCADE,
  purchase_order_item_id uuid REFERENCES public.purchase_order_items(id) ON DELETE SET NULL,
  variant_id uuid NOT NULL REFERENCES public.product_variants(id) ON DELETE RESTRICT,
  quantity_received numeric(14,3) NOT NULL,
  quantity_accepted numeric(14,3) NOT NULL,
  quantity_rejected numeric(14,3) NOT NULL DEFAULT 0,
  unit_cost numeric(14,4) NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_gri_gr ON public.goods_receipt_items(goods_receipt_id);
CREATE INDEX idx_gri_variant ON public.goods_receipt_items(variant_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.goods_receipt_items TO authenticated;
GRANT ALL ON public.goods_receipt_items TO service_role;
ALTER TABLE public.goods_receipt_items ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.gr_store_id(_gr_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT store_id FROM public.goods_receipts WHERE id = _gr_id
$$;
CREATE POLICY "gri read" ON public.goods_receipt_items FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(),'purchases.read',public.gr_store_id(goods_receipt_id)));
CREATE POLICY "gri write" ON public.goods_receipt_items FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(),'purchases.manage',public.gr_store_id(goods_receipt_id)))
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(),'purchases.manage',public.gr_store_id(goods_receipt_id)));

CREATE TABLE public.inventory_counts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  warehouse_id uuid NOT NULL REFERENCES public.warehouses(id) ON DELETE RESTRICT,
  count_number text NOT NULL,
  count_type text NOT NULL DEFAULT 'full' CHECK (count_type IN ('full','cyclic','spot','category')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','in_progress','completed','cancelled','approved')),
  scheduled_date date, started_at timestamptz, completed_at timestamptz,
  approved_at timestamptz, approved_by uuid, notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, count_number)
);
CREATE INDEX idx_ic_store ON public.inventory_counts(store_id);
CREATE INDEX idx_ic_warehouse ON public.inventory_counts(warehouse_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_counts TO authenticated;
GRANT ALL ON public.inventory_counts TO service_role;
ALTER TABLE public.inventory_counts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ic read" ON public.inventory_counts FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(),'inventory.read',store_id));
CREATE POLICY "ic write" ON public.inventory_counts FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(),'inventory.manage',store_id))
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(),'inventory.manage',store_id));
CREATE TRIGGER trg_ic_updated BEFORE UPDATE ON public.inventory_counts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.inventory_count_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_count_id uuid NOT NULL REFERENCES public.inventory_counts(id) ON DELETE CASCADE,
  variant_id uuid NOT NULL REFERENCES public.product_variants(id) ON DELETE RESTRICT,
  expected_quantity numeric(14,3) NOT NULL DEFAULT 0,
  counted_quantity numeric(14,3),
  variance numeric(14,3),
  unit_cost numeric(14,4),
  counted_by uuid, counted_at timestamptz, notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ici_ic ON public.inventory_count_items(inventory_count_id);
CREATE INDEX idx_ici_variant ON public.inventory_count_items(variant_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_count_items TO authenticated;
GRANT ALL ON public.inventory_count_items TO service_role;
ALTER TABLE public.inventory_count_items ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.ic_store_id(_ic_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT store_id FROM public.inventory_counts WHERE id = _ic_id
$$;
CREATE POLICY "ici read" ON public.inventory_count_items FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(),'inventory.read',public.ic_store_id(inventory_count_id)));
CREATE POLICY "ici write" ON public.inventory_count_items FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(),'inventory.manage',public.ic_store_id(inventory_count_id)))
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(),'inventory.manage',public.ic_store_id(inventory_count_id)));
CREATE TRIGGER trg_ici_updated BEFORE UPDATE ON public.inventory_count_items FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.stock_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  transfer_number text NOT NULL,
  origin_warehouse_id uuid NOT NULL REFERENCES public.warehouses(id) ON DELETE RESTRICT,
  destination_warehouse_id uuid NOT NULL REFERENCES public.warehouses(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','in_transit','received','partially_received','cancelled')),
  shipped_at timestamptz, received_at timestamptz,
  shipped_by uuid, received_by uuid, notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, transfer_number),
  CHECK (origin_warehouse_id <> destination_warehouse_id)
);
CREATE INDEX idx_st_store ON public.stock_transfers(store_id);
CREATE INDEX idx_st_origin ON public.stock_transfers(origin_warehouse_id);
CREATE INDEX idx_st_dest ON public.stock_transfers(destination_warehouse_id);
CREATE INDEX idx_st_status ON public.stock_transfers(store_id, status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_transfers TO authenticated;
GRANT ALL ON public.stock_transfers TO service_role;
ALTER TABLE public.stock_transfers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "st read" ON public.stock_transfers FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(),'inventory.read',store_id));
CREATE POLICY "st write" ON public.stock_transfers FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(),'inventory.manage',store_id))
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(),'inventory.manage',store_id));
CREATE TRIGGER trg_st_updated BEFORE UPDATE ON public.stock_transfers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.stock_transfer_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_transfer_id uuid NOT NULL REFERENCES public.stock_transfers(id) ON DELETE CASCADE,
  variant_id uuid NOT NULL REFERENCES public.product_variants(id) ON DELETE RESTRICT,
  quantity_shipped numeric(14,3) NOT NULL,
  quantity_received numeric(14,3) NOT NULL DEFAULT 0,
  unit_cost numeric(14,4), notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_sti_st ON public.stock_transfer_items(stock_transfer_id);
CREATE INDEX idx_sti_variant ON public.stock_transfer_items(variant_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_transfer_items TO authenticated;
GRANT ALL ON public.stock_transfer_items TO service_role;
ALTER TABLE public.stock_transfer_items ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.st_store_id(_st_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT store_id FROM public.stock_transfers WHERE id = _st_id
$$;
CREATE POLICY "sti read" ON public.stock_transfer_items FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(),'inventory.read',public.st_store_id(stock_transfer_id)));
CREATE POLICY "sti write" ON public.stock_transfer_items FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(),'inventory.manage',public.st_store_id(stock_transfer_id)))
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(),'inventory.manage',public.st_store_id(stock_transfer_id)));
CREATE TRIGGER trg_sti_updated BEFORE UPDATE ON public.stock_transfer_items FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RBAC permissões
INSERT INTO public.permissions (code, module, description) VALUES
  ('suppliers.read',   'suppliers', 'Visualizar fornecedores'),
  ('suppliers.manage', 'suppliers', 'Gerenciar fornecedores'),
  ('purchases.read',   'purchases', 'Visualizar compras e recebimentos'),
  ('purchases.manage', 'purchases', 'Gerenciar compras e recebimentos'),
  ('inventory.read',   'inventory', 'Visualizar estoque, armazéns e movimentações'),
  ('inventory.manage', 'inventory', 'Movimentar, transferir e inventariar estoque')
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r CROSS JOIN public.permissions p
WHERE r.code IN ('super_admin','admin','manager')
  AND p.code IN ('suppliers.read','suppliers.manage','purchases.read','purchases.manage','inventory.read','inventory.manage')
ON CONFLICT DO NOTHING;
