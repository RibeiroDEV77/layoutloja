
-- ============================================================
-- MIGRATION 2/3 — OMS OPERATIONS (Phase 5.3 v1.1)
-- ============================================================

-- ===== ENUMS =====
DO $$ BEGIN CREATE TYPE public.order_payment_status AS ENUM
  ('pending','authorized','captured','failed','refunded','partially_refunded','voided','chargeback');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE public.order_payment_method AS ENUM
  ('pix','credit_card','debit_card','boleto','bank_transfer','wallet','store_credit','manual','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE public.order_allocation_scope AS ENUM ('item','shipping','tax','fee','total');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE public.order_hold_kind AS ENUM
  ('payment','fraud','inventory','manual_review','address','custom');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE public.order_hold_status AS ENUM ('active','released','expired');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE public.order_fulfillment_status AS ENUM
  ('pending','picking','packed','ready','partially_fulfilled','fulfilled','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE public.order_shipment_status AS ENUM
  ('pending','ready','dispatched','in_transit','out_for_delivery','delivered','failed','returned');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE public.order_split_status AS ENUM
  ('draft','confirmed','fulfilled','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE public.order_return_status AS ENUM
  ('requested','approved','rejected','in_transit','received','inspected','completed','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE public.order_return_reason AS ENUM
  ('defect','wrong_item','damaged','not_as_described','no_longer_wanted','late_delivery','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE public.order_note_visibility AS ENUM ('internal','customer','system');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE public.order_assignment_role AS ENUM
  ('owner','fulfillment','support','finance','reviewer');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ===== PAYMENTS =====
CREATE TABLE public.order_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  store_id uuid NOT NULL,
  method public.order_payment_method NOT NULL,
  status public.order_payment_status NOT NULL DEFAULT 'pending',
  gateway text,
  gateway_transaction_id text,
  amount numeric(14,2) NOT NULL,
  currency text NOT NULL DEFAULT 'BRL',
  authorized_at timestamptz,
  captured_at timestamptz,
  refunded_amount numeric(14,2) NOT NULL DEFAULT 0,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  idempotency_key text,
  correlation_id uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT order_payments_amount_pos CHECK (amount > 0),
  CONSTRAINT order_payments_refunded_nonneg CHECK (refunded_amount >= 0 AND refunded_amount <= amount)
);
CREATE INDEX order_payments_order_idx ON public.order_payments(order_id);
CREATE INDEX order_payments_store_status_idx ON public.order_payments(store_id, status);
CREATE INDEX order_payments_gateway_tx_idx ON public.order_payments(gateway, gateway_transaction_id) WHERE gateway_transaction_id IS NOT NULL;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_payments TO authenticated;
GRANT ALL ON public.order_payments TO service_role;

CREATE TABLE public.order_payment_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL REFERENCES public.order_payments(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  store_id uuid NOT NULL,
  scope public.order_allocation_scope NOT NULL,
  order_item_id uuid REFERENCES public.order_items(id) ON DELETE CASCADE,
  amount numeric(14,2) NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT opa_amount_pos CHECK (amount > 0),
  CONSTRAINT opa_item_scope CHECK ((scope = 'item') = (order_item_id IS NOT NULL))
);
CREATE INDEX opa_payment_idx ON public.order_payment_allocations(payment_id);
CREATE INDEX opa_order_idx ON public.order_payment_allocations(order_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_payment_allocations TO authenticated;
GRANT ALL ON public.order_payment_allocations TO service_role;

-- ===== HOLD ENGINE =====
CREATE TABLE public.hold_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  kind public.order_hold_kind NOT NULL,
  description text,
  triggers jsonb NOT NULL DEFAULT '[]'::jsonb,
  blocks_transitions jsonb NOT NULL DEFAULT '[]'::jsonb,
  auto_release_after_seconds integer,
  enabled boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX hold_policies_store_code_uk ON public.hold_policies(store_id, code);
CREATE INDEX hold_policies_kind_idx ON public.hold_policies(store_id, kind);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hold_policies TO authenticated;
GRANT ALL ON public.hold_policies TO service_role;

CREATE TABLE public.order_holds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  store_id uuid NOT NULL,
  policy_id uuid REFERENCES public.hold_policies(id) ON DELETE SET NULL,
  kind public.order_hold_kind NOT NULL,
  status public.order_hold_status NOT NULL DEFAULT 'active',
  reason text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  released_by uuid,
  released_reason text,
  released_at timestamptz,
  expires_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX order_holds_order_idx ON public.order_holds(order_id);
CREATE INDEX order_holds_active_idx ON public.order_holds(order_id) WHERE status = 'active';
CREATE INDEX order_holds_store_kind_idx ON public.order_holds(store_id, kind, status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_holds TO authenticated;
GRANT ALL ON public.order_holds TO service_role;

-- ===== FULFILLMENT =====
CREATE TABLE public.order_fulfillments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  store_id uuid NOT NULL,
  warehouse_id uuid REFERENCES public.warehouses(id) ON DELETE SET NULL,
  status public.order_fulfillment_status NOT NULL DEFAULT 'pending',
  picked_at timestamptz,
  packed_at timestamptz,
  ready_at timestamptz,
  cancelled_at timestamptz,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  assigned_user_id uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX order_fulfillments_order_idx ON public.order_fulfillments(order_id);
CREATE INDEX order_fulfillments_store_status_idx ON public.order_fulfillments(store_id, status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_fulfillments TO authenticated;
GRANT ALL ON public.order_fulfillments TO service_role;

-- ===== SHIPMENTS =====
CREATE TABLE public.order_shipments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  fulfillment_id uuid REFERENCES public.order_fulfillments(id) ON DELETE SET NULL,
  store_id uuid NOT NULL,
  carrier text,
  service text,
  tracking_code text,
  tracking_url text,
  status public.order_shipment_status NOT NULL DEFAULT 'pending',
  shipped_at timestamptz,
  estimated_delivery_at timestamptz,
  delivered_at timestamptz,
  cost numeric(14,2),
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX order_shipments_order_idx ON public.order_shipments(order_id);
CREATE INDEX order_shipments_tracking_idx ON public.order_shipments(tracking_code) WHERE tracking_code IS NOT NULL;
CREATE INDEX order_shipments_store_status_idx ON public.order_shipments(store_id, status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_shipments TO authenticated;
GRANT ALL ON public.order_shipments TO service_role;

-- ===== SPLITS =====
CREATE TABLE public.order_splits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  store_id uuid NOT NULL,
  split_number integer NOT NULL,
  warehouse_id uuid REFERENCES public.warehouses(id) ON DELETE SET NULL,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  status public.order_split_status NOT NULL DEFAULT 'draft',
  reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  confirmed_at timestamptz,
  fulfilled_at timestamptz,
  cancelled_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX order_splits_order_number_uk ON public.order_splits(order_id, split_number);
CREATE INDEX order_splits_store_status_idx ON public.order_splits(store_id, status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_splits TO authenticated;
GRANT ALL ON public.order_splits TO service_role;

CREATE TABLE public.order_split_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  split_id uuid NOT NULL REFERENCES public.order_splits(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  order_item_id uuid NOT NULL REFERENCES public.order_items(id) ON DELETE CASCADE,
  store_id uuid NOT NULL,
  qty numeric(14,3) NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT order_split_items_qty_pos CHECK (qty > 0)
);
CREATE INDEX order_split_items_split_idx ON public.order_split_items(split_id);
CREATE INDEX order_split_items_order_idx ON public.order_split_items(order_id);
CREATE INDEX order_split_items_item_idx ON public.order_split_items(order_item_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_split_items TO authenticated;
GRANT ALL ON public.order_split_items TO service_role;

-- ===== RETURNS / RMA =====
CREATE TABLE public.order_returns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  store_id uuid NOT NULL,
  rma_number text NOT NULL,
  status public.order_return_status NOT NULL DEFAULT 'requested',
  reason public.order_return_reason NOT NULL,
  reason_note text,
  refund_amount numeric(14,2) NOT NULL DEFAULT 0,
  restocking_fee numeric(14,2) NOT NULL DEFAULT 0,
  received_at timestamptz,
  inspected_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT order_returns_refund_nonneg CHECK (refund_amount >= 0),
  CONSTRAINT order_returns_fee_nonneg CHECK (restocking_fee >= 0)
);
CREATE UNIQUE INDEX order_returns_store_rma_uk ON public.order_returns(store_id, rma_number);
CREATE INDEX order_returns_order_idx ON public.order_returns(order_id);
CREATE INDEX order_returns_store_status_idx ON public.order_returns(store_id, status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_returns TO authenticated;
GRANT ALL ON public.order_returns TO service_role;

CREATE TABLE public.order_return_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id uuid NOT NULL REFERENCES public.order_returns(id) ON DELETE CASCADE,
  order_item_id uuid NOT NULL REFERENCES public.order_items(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  store_id uuid NOT NULL,
  qty numeric(14,3) NOT NULL,
  refund_amount numeric(14,2) NOT NULL DEFAULT 0,
  condition text,
  resaleable boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT order_return_items_qty_pos CHECK (qty > 0)
);
CREATE INDEX order_return_items_return_idx ON public.order_return_items(return_id);
CREATE INDEX order_return_items_order_idx ON public.order_return_items(order_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_return_items TO authenticated;
GRANT ALL ON public.order_return_items TO service_role;

-- ===== LOCKS =====
CREATE TABLE public.order_locks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  store_id uuid NOT NULL,
  scope text NOT NULL,
  owner_token text NOT NULL,
  owner_user_id uuid,
  acquired_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE UNIQUE INDEX order_locks_order_scope_uk ON public.order_locks(order_id, scope);
CREATE INDEX order_locks_expires_idx ON public.order_locks(expires_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_locks TO authenticated;
GRANT ALL ON public.order_locks TO service_role;

-- ===== NOTES =====
CREATE TABLE public.order_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  store_id uuid NOT NULL,
  visibility public.order_note_visibility NOT NULL DEFAULT 'internal',
  body text NOT NULL,
  author_user_id uuid,
  pinned boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX order_notes_order_idx ON public.order_notes(order_id, created_at DESC);
CREATE INDEX order_notes_pinned_idx ON public.order_notes(order_id) WHERE pinned;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_notes TO authenticated;
GRANT ALL ON public.order_notes TO service_role;

-- ===== TAG ASSIGNMENTS (reuse public.tags catalog) =====
CREATE TABLE public.order_tag_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  store_id uuid NOT NULL,
  tag_id uuid NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  assigned_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX order_tag_assignments_uk ON public.order_tag_assignments(order_id, tag_id);
CREATE INDEX order_tag_assignments_tag_idx ON public.order_tag_assignments(tag_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_tag_assignments TO authenticated;
GRANT ALL ON public.order_tag_assignments TO service_role;

-- ===== ASSIGNMENTS =====
CREATE TABLE public.order_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  store_id uuid NOT NULL,
  user_id uuid NOT NULL,
  role public.order_assignment_role NOT NULL DEFAULT 'owner',
  assigned_by uuid,
  unassigned_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX order_assignments_active_uk ON public.order_assignments(order_id, user_id, role) WHERE unassigned_at IS NULL;
CREATE INDEX order_assignments_user_idx ON public.order_assignments(user_id) WHERE unassigned_at IS NULL;
CREATE INDEX order_assignments_order_idx ON public.order_assignments(order_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_assignments TO authenticated;
GRANT ALL ON public.order_assignments TO service_role;

-- ===== UPDATED_AT TRIGGERS =====
CREATE TRIGGER trg_order_payments_updated_at BEFORE UPDATE ON public.order_payments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_hold_policies_updated_at BEFORE UPDATE ON public.hold_policies FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_order_holds_updated_at BEFORE UPDATE ON public.order_holds FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_order_fulfillments_updated_at BEFORE UPDATE ON public.order_fulfillments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_order_shipments_updated_at BEFORE UPDATE ON public.order_shipments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_order_splits_updated_at BEFORE UPDATE ON public.order_splits FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_order_returns_updated_at BEFORE UPDATE ON public.order_returns FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_order_notes_updated_at BEFORE UPDATE ON public.order_notes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ===== AUDIT TRIGGERS (replica para entidades operacionais críticas) =====
CREATE TRIGGER trg_order_payments_audit AFTER INSERT OR UPDATE OR DELETE ON public.order_payments FOR EACH ROW EXECUTE FUNCTION public.order_audit_row_change();
CREATE TRIGGER trg_order_holds_audit AFTER INSERT OR UPDATE OR DELETE ON public.order_holds FOR EACH ROW EXECUTE FUNCTION public.order_audit_row_change();
CREATE TRIGGER trg_order_fulfillments_audit AFTER INSERT OR UPDATE OR DELETE ON public.order_fulfillments FOR EACH ROW EXECUTE FUNCTION public.order_audit_row_change();
CREATE TRIGGER trg_order_shipments_audit AFTER INSERT OR UPDATE OR DELETE ON public.order_shipments FOR EACH ROW EXECUTE FUNCTION public.order_audit_row_change();
CREATE TRIGGER trg_order_splits_audit AFTER INSERT OR UPDATE OR DELETE ON public.order_splits FOR EACH ROW EXECUTE FUNCTION public.order_audit_row_change();
CREATE TRIGGER trg_order_returns_audit AFTER INSERT OR UPDATE OR DELETE ON public.order_returns FOR EACH ROW EXECUTE FUNCTION public.order_audit_row_change();

-- ===== LOCK RPCs =====
CREATE OR REPLACE FUNCTION public.acquire_order_lock(
  _order_id uuid, _scope text, _owner_token text, _ttl_seconds integer DEFAULT 60
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_existing public.order_locks%ROWTYPE;
  v_store_id uuid;
  v_id uuid;
BEGIN
  SELECT store_id INTO v_store_id FROM public.orders WHERE id = _order_id;
  IF v_store_id IS NULL THEN
    RETURN jsonb_build_object('acquired', false, 'reason', 'order_not_found');
  END IF;

  -- limpa lock expirado
  DELETE FROM public.order_locks
    WHERE order_id = _order_id AND scope = _scope AND expires_at < now();

  SELECT * INTO v_existing FROM public.order_locks
    WHERE order_id = _order_id AND scope = _scope;

  IF FOUND THEN
    IF v_existing.owner_token = _owner_token THEN
      UPDATE public.order_locks SET expires_at = now() + make_interval(secs => _ttl_seconds)
        WHERE id = v_existing.id;
      RETURN jsonb_build_object('acquired', true, 'lock_id', v_existing.id, 'renewed', true);
    END IF;
    RETURN jsonb_build_object('acquired', false, 'reason', 'locked', 'expires_at', v_existing.expires_at);
  END IF;

  INSERT INTO public.order_locks(order_id, store_id, scope, owner_token, owner_user_id, expires_at)
  VALUES (_order_id, v_store_id, _scope, _owner_token, auth.uid(), now() + make_interval(secs => _ttl_seconds))
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('acquired', true, 'lock_id', v_id, 'renewed', false);
END $$;

CREATE OR REPLACE FUNCTION public.release_order_lock(
  _order_id uuid, _scope text, _owner_token text
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_deleted int;
BEGIN
  WITH d AS (
    DELETE FROM public.order_locks
      WHERE order_id = _order_id AND scope = _scope AND owner_token = _owner_token
      RETURNING 1
  ) SELECT count(*) INTO v_deleted FROM d;
  RETURN v_deleted > 0;
END $$;

-- ===== RLS =====
ALTER TABLE public.order_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_payment_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hold_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_holds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_fulfillments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_splits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_split_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_return_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_locks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_tag_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_assignments ENABLE ROW LEVEL SECURITY;

-- Payments
CREATE POLICY "op_read" ON public.order_payments FOR SELECT TO authenticated
USING (is_super_admin(auth.uid()) OR has_permission(auth.uid(), 'orders.read', store_id));
CREATE POLICY "op_write" ON public.order_payments FOR ALL TO authenticated
USING (is_super_admin(auth.uid()) OR has_permission(auth.uid(), 'orders.payment', store_id))
WITH CHECK (is_super_admin(auth.uid()) OR has_permission(auth.uid(), 'orders.payment', store_id));

CREATE POLICY "opa_read" ON public.order_payment_allocations FOR SELECT TO authenticated
USING (is_super_admin(auth.uid()) OR has_permission(auth.uid(), 'orders.read', store_id));
CREATE POLICY "opa_write" ON public.order_payment_allocations FOR ALL TO authenticated
USING (is_super_admin(auth.uid()) OR has_permission(auth.uid(), 'orders.payment', store_id))
WITH CHECK (is_super_admin(auth.uid()) OR has_permission(auth.uid(), 'orders.payment', store_id));

-- Hold policies
CREATE POLICY "hp_read" ON public.hold_policies FOR SELECT TO authenticated
USING (is_super_admin(auth.uid()) OR has_permission(auth.uid(), 'orders.read', store_id));
CREATE POLICY "hp_write" ON public.hold_policies FOR ALL TO authenticated
USING (is_super_admin(auth.uid()) OR has_permission(auth.uid(), 'orders.hold', store_id))
WITH CHECK (is_super_admin(auth.uid()) OR has_permission(auth.uid(), 'orders.hold', store_id));

-- Holds
CREATE POLICY "oh_read" ON public.order_holds FOR SELECT TO authenticated
USING (is_super_admin(auth.uid()) OR has_permission(auth.uid(), 'orders.read', store_id));
CREATE POLICY "oh_write" ON public.order_holds FOR ALL TO authenticated
USING (is_super_admin(auth.uid()) OR has_permission(auth.uid(), 'orders.hold', store_id))
WITH CHECK (is_super_admin(auth.uid()) OR has_permission(auth.uid(), 'orders.hold', store_id));

-- Fulfillments
CREATE POLICY "of_read" ON public.order_fulfillments FOR SELECT TO authenticated
USING (is_super_admin(auth.uid()) OR has_permission(auth.uid(), 'orders.read', store_id));
CREATE POLICY "of_write" ON public.order_fulfillments FOR ALL TO authenticated
USING (is_super_admin(auth.uid()) OR has_permission(auth.uid(), 'orders.fulfill', store_id))
WITH CHECK (is_super_admin(auth.uid()) OR has_permission(auth.uid(), 'orders.fulfill', store_id));

-- Shipments
CREATE POLICY "os_read" ON public.order_shipments FOR SELECT TO authenticated
USING (is_super_admin(auth.uid()) OR has_permission(auth.uid(), 'orders.read', store_id));
CREATE POLICY "os_write" ON public.order_shipments FOR ALL TO authenticated
USING (is_super_admin(auth.uid()) OR has_permission(auth.uid(), 'orders.ship', store_id))
WITH CHECK (is_super_admin(auth.uid()) OR has_permission(auth.uid(), 'orders.ship', store_id));

-- Splits
CREATE POLICY "osp_read" ON public.order_splits FOR SELECT TO authenticated
USING (is_super_admin(auth.uid()) OR has_permission(auth.uid(), 'orders.read', store_id));
CREATE POLICY "osp_write" ON public.order_splits FOR ALL TO authenticated
USING (is_super_admin(auth.uid()) OR has_permission(auth.uid(), 'orders.fulfill', store_id))
WITH CHECK (is_super_admin(auth.uid()) OR has_permission(auth.uid(), 'orders.fulfill', store_id));

CREATE POLICY "ospi_read" ON public.order_split_items FOR SELECT TO authenticated
USING (is_super_admin(auth.uid()) OR has_permission(auth.uid(), 'orders.read', store_id));
CREATE POLICY "ospi_write" ON public.order_split_items FOR ALL TO authenticated
USING (is_super_admin(auth.uid()) OR has_permission(auth.uid(), 'orders.fulfill', store_id))
WITH CHECK (is_super_admin(auth.uid()) OR has_permission(auth.uid(), 'orders.fulfill', store_id));

-- Returns
CREATE POLICY "or_read" ON public.order_returns FOR SELECT TO authenticated
USING (is_super_admin(auth.uid()) OR has_permission(auth.uid(), 'orders.read', store_id));
CREATE POLICY "or_write" ON public.order_returns FOR ALL TO authenticated
USING (is_super_admin(auth.uid()) OR has_permission(auth.uid(), 'orders.return', store_id))
WITH CHECK (is_super_admin(auth.uid()) OR has_permission(auth.uid(), 'orders.return', store_id));

CREATE POLICY "ori_read" ON public.order_return_items FOR SELECT TO authenticated
USING (is_super_admin(auth.uid()) OR has_permission(auth.uid(), 'orders.read', store_id));
CREATE POLICY "ori_write" ON public.order_return_items FOR ALL TO authenticated
USING (is_super_admin(auth.uid()) OR has_permission(auth.uid(), 'orders.return', store_id))
WITH CHECK (is_super_admin(auth.uid()) OR has_permission(auth.uid(), 'orders.return', store_id));

-- Locks (qualquer usuário com orders.write pode adquirir/liberar via RPC; tabela protegida)
CREATE POLICY "ol_read" ON public.order_locks FOR SELECT TO authenticated
USING (is_super_admin(auth.uid()) OR has_permission(auth.uid(), 'orders.read', store_id));
CREATE POLICY "ol_write" ON public.order_locks FOR ALL TO authenticated
USING (is_super_admin(auth.uid()) OR has_permission(auth.uid(), 'orders.write', store_id))
WITH CHECK (is_super_admin(auth.uid()) OR has_permission(auth.uid(), 'orders.write', store_id));

-- Notes
CREATE POLICY "on_read" ON public.order_notes FOR SELECT TO authenticated
USING (is_super_admin(auth.uid()) OR has_permission(auth.uid(), 'orders.read', store_id));
CREATE POLICY "on_write" ON public.order_notes FOR ALL TO authenticated
USING (is_super_admin(auth.uid()) OR has_permission(auth.uid(), 'orders.note', store_id))
WITH CHECK (is_super_admin(auth.uid()) OR has_permission(auth.uid(), 'orders.note', store_id));

-- Tag assignments
CREATE POLICY "ota_read" ON public.order_tag_assignments FOR SELECT TO authenticated
USING (is_super_admin(auth.uid()) OR has_permission(auth.uid(), 'orders.read', store_id));
CREATE POLICY "ota_write" ON public.order_tag_assignments FOR ALL TO authenticated
USING (is_super_admin(auth.uid()) OR has_permission(auth.uid(), 'orders.tag', store_id))
WITH CHECK (is_super_admin(auth.uid()) OR has_permission(auth.uid(), 'orders.tag', store_id));

-- Assignments
CREATE POLICY "oas_read" ON public.order_assignments FOR SELECT TO authenticated
USING (is_super_admin(auth.uid()) OR has_permission(auth.uid(), 'orders.read', store_id));
CREATE POLICY "oas_write" ON public.order_assignments FOR ALL TO authenticated
USING (is_super_admin(auth.uid()) OR has_permission(auth.uid(), 'orders.assign', store_id))
WITH CHECK (is_super_admin(auth.uid()) OR has_permission(auth.uid(), 'orders.assign', store_id));
