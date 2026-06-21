
-- =====================================================================
-- FULFILLMENT & LOGISTICS — MIGRATION 1/3
-- Core Aggregate
-- =====================================================================

-- ENUMS -------------------------------------------------------------
CREATE TYPE public.fulfillment_status AS ENUM (
  'pending','allocated','picking','picked','packing','packed',
  'awaiting_shipment','shipped','in_transit','delivered',
  'cancelled','failed'
);

CREATE TYPE public.fulfillment_type AS ENUM (
  'standard','express','pickup','digital'
);

CREATE TYPE public.fulfillment_priority AS ENUM (
  'low','normal','high','urgent'
);

CREATE TYPE public.fulfillment_fulfillable_type AS ENUM (
  'order'
);

CREATE TYPE public.fulfillment_event_actor AS ENUM (
  'system','user','carrier','customer'
);

CREATE TYPE public.fulfillment_event_kind AS ENUM (
  'created','allocated','status_changed','item_added','item_removed',
  'note_added','carrier_assigned','escalated','sla_breached'
);

-- TABLE: fulfillments (aggregate root) ------------------------------
CREATE TABLE public.fulfillments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  fulfillment_number text NOT NULL,
  fulfillable_type public.fulfillment_fulfillable_type NOT NULL DEFAULT 'order',
  fulfillable_id uuid NOT NULL,
  warehouse_id uuid REFERENCES public.warehouses(id) ON DELETE RESTRICT,
  type public.fulfillment_type NOT NULL DEFAULT 'standard',
  priority public.fulfillment_priority NOT NULL DEFAULT 'normal',
  status public.fulfillment_status NOT NULL DEFAULT 'pending',
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  assigned_to uuid REFERENCES auth.users(id),
  sla_due_at timestamptz,
  allocated_at timestamptz,
  picked_at timestamptz,
  packed_at timestamptz,
  shipped_at timestamptz,
  delivered_at timestamptz,
  cancelled_at timestamptz,
  cancellation_reason text,
  failure_code text,
  failure_message text,
  version integer NOT NULL DEFAULT 1,
  trace_id uuid,
  correlation_id uuid,
  causation_id uuid,
  schema_version integer NOT NULL DEFAULT 1,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(store_id, fulfillment_number)
);
CREATE INDEX idx_fulfillments_store_status ON public.fulfillments(store_id, status);
CREATE INDEX idx_fulfillments_fulfillable ON public.fulfillments(fulfillable_type, fulfillable_id);
CREATE INDEX idx_fulfillments_warehouse ON public.fulfillments(warehouse_id, status) WHERE warehouse_id IS NOT NULL;
CREATE INDEX idx_fulfillments_assigned ON public.fulfillments(assigned_to) WHERE assigned_to IS NOT NULL;
CREATE INDEX idx_fulfillments_sla ON public.fulfillments(sla_due_at) WHERE sla_due_at IS NOT NULL AND status NOT IN ('delivered','cancelled','failed');

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fulfillments TO authenticated;
GRANT ALL ON public.fulfillments TO service_role;
ALTER TABLE public.fulfillments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fulfillments_select" ON public.fulfillments FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(),'fulfillment.read',store_id));

-- INSERT/UPDATE/DELETE blocked at RLS — only via SECURITY DEFINER RPCs (Migration 3/3)
CREATE POLICY "fulfillments_block_direct_write" ON public.fulfillments FOR ALL TO authenticated
  USING (false) WITH CHECK (false);

CREATE TRIGGER trg_fulfillments_updated BEFORE UPDATE ON public.fulfillments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Optimistic locking ------------------------------------------------
CREATE OR REPLACE FUNCTION public.fulfillments_bump_version()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.version := OLD.version + 1;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_fulfillments_bump_version
  BEFORE UPDATE ON public.fulfillments
  FOR EACH ROW EXECUTE FUNCTION public.fulfillments_bump_version();

-- State machine guard -----------------------------------------------
CREATE OR REPLACE FUNCTION public.fulfillments_status_transition_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_allowed boolean := false;
BEGIN
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;

  v_allowed := CASE OLD.status
    WHEN 'pending'           THEN NEW.status IN ('allocated','cancelled','failed')
    WHEN 'allocated'         THEN NEW.status IN ('picking','cancelled','failed')
    WHEN 'picking'           THEN NEW.status IN ('picked','failed','cancelled')
    WHEN 'picked'            THEN NEW.status IN ('packing','failed')
    WHEN 'packing'           THEN NEW.status IN ('packed','failed')
    WHEN 'packed'            THEN NEW.status IN ('awaiting_shipment','failed')
    WHEN 'awaiting_shipment' THEN NEW.status IN ('shipped','failed','cancelled')
    WHEN 'shipped'           THEN NEW.status IN ('in_transit','delivered','failed')
    WHEN 'in_transit'        THEN NEW.status IN ('delivered','failed')
    WHEN 'delivered'         THEN false
    WHEN 'cancelled'         THEN false
    WHEN 'failed'            THEN NEW.status IN ('pending')  -- retry-friendly
    ELSE false
  END;

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'Invalid fulfillment status transition: % -> %', OLD.status, NEW.status
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END $$;

CREATE TRIGGER trg_fulfillments_status_transition_guard
  BEFORE UPDATE OF status ON public.fulfillments
  FOR EACH ROW EXECUTE FUNCTION public.fulfillments_status_transition_guard();

-- Outbox trigger -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.tg_fulfillments_enqueue_outbox()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_event_type text;
  v_payload jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_event_type := 'fulfillment.created';
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    v_event_type := 'fulfillment.' || NEW.status::text;
  ELSE
    RETURN NEW;
  END IF;

  v_payload := jsonb_build_object(
    'fulfillment_id', NEW.id,
    'store_id', NEW.store_id,
    'fulfillment_number', NEW.fulfillment_number,
    'fulfillable_type', NEW.fulfillable_type,
    'fulfillable_id', NEW.fulfillable_id,
    'warehouse_id', NEW.warehouse_id,
    'type', NEW.type,
    'priority', NEW.priority,
    'status', NEW.status,
    'version', NEW.version,
    'schema_version', NEW.schema_version
  );

  PERFORM public.enqueue_outbox_event(
    NEW.store_id,
    v_event_type,
    'fulfillment',
    NEW.id,
    v_payload,
    NEW.trace_id,
    NEW.correlation_id,
    NEW.causation_id
  );
  RETURN NEW;
END $$;

CREATE TRIGGER trg_fulfillments_outbox
  AFTER INSERT OR UPDATE OF status ON public.fulfillments
  FOR EACH ROW EXECUTE FUNCTION public.tg_fulfillments_enqueue_outbox();

-- TABLE: fulfillment_items -----------------------------------------
CREATE TABLE public.fulfillment_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fulfillment_id uuid NOT NULL REFERENCES public.fulfillments(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  order_item_id uuid REFERENCES public.order_items(id) ON DELETE SET NULL,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  variant_id uuid REFERENCES public.product_variants(id) ON DELETE SET NULL,
  sku text,
  name text,
  quantity_requested numeric NOT NULL CHECK (quantity_requested > 0),
  quantity_allocated numeric NOT NULL DEFAULT 0 CHECK (quantity_allocated >= 0),
  quantity_picked numeric NOT NULL DEFAULT 0 CHECK (quantity_picked >= 0),
  quantity_packed numeric NOT NULL DEFAULT 0 CHECK (quantity_packed >= 0),
  quantity_shipped numeric NOT NULL DEFAULT 0 CHECK (quantity_shipped >= 0),
  quantity_delivered numeric NOT NULL DEFAULT 0 CHECK (quantity_delivered >= 0),
  unit_weight_g numeric,
  unit_volume_cm3 numeric,
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_fulfillment_items_fulfillment ON public.fulfillment_items(fulfillment_id);
CREATE INDEX idx_fulfillment_items_order_item ON public.fulfillment_items(order_item_id) WHERE order_item_id IS NOT NULL;
CREATE INDEX idx_fulfillment_items_sku ON public.fulfillment_items(store_id, sku);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fulfillment_items TO authenticated;
GRANT ALL ON public.fulfillment_items TO service_role;
ALTER TABLE public.fulfillment_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fulfillment_items_select" ON public.fulfillment_items FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(),'fulfillment.read',store_id));

CREATE POLICY "fulfillment_items_block_direct_write" ON public.fulfillment_items FOR ALL TO authenticated
  USING (false) WITH CHECK (false);

CREATE TRIGGER trg_fulfillment_items_updated BEFORE UPDATE ON public.fulfillment_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- TABLE: fulfillment_events (append-only) ---------------------------
CREATE TABLE public.fulfillment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fulfillment_id uuid NOT NULL REFERENCES public.fulfillments(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  kind public.fulfillment_event_kind NOT NULL,
  actor_kind public.fulfillment_event_actor NOT NULL DEFAULT 'system',
  actor_user_id uuid REFERENCES auth.users(id),
  summary text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  trace_id uuid,
  correlation_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_fulfillment_events_fulfillment ON public.fulfillment_events(fulfillment_id, created_at DESC);
CREATE INDEX idx_fulfillment_events_store ON public.fulfillment_events(store_id, created_at DESC);

GRANT SELECT ON public.fulfillment_events TO authenticated;
GRANT ALL ON public.fulfillment_events TO service_role;
ALTER TABLE public.fulfillment_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fulfillment_events_select" ON public.fulfillment_events FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(),'fulfillment.audit',store_id));

CREATE OR REPLACE FUNCTION public.fulfillment_events_append_only()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN RAISE EXCEPTION 'fulfillment_events is append-only'; END $$;

CREATE TRIGGER trg_fulfillment_events_append_only
  BEFORE UPDATE OR DELETE ON public.fulfillment_events
  FOR EACH ROW EXECUTE FUNCTION public.fulfillment_events_append_only();

-- TABLE: fulfillment_metadata ---------------------------------------
CREATE TABLE public.fulfillment_metadata (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fulfillment_id uuid NOT NULL REFERENCES public.fulfillments(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  key text NOT NULL,
  value jsonb NOT NULL,
  is_pii boolean NOT NULL DEFAULT false,
  is_secret boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(fulfillment_id, key)
);
CREATE INDEX idx_fulfillment_metadata_fulfillment ON public.fulfillment_metadata(fulfillment_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fulfillment_metadata TO authenticated;
GRANT ALL ON public.fulfillment_metadata TO service_role;
ALTER TABLE public.fulfillment_metadata ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fulfillment_metadata_select_normal" ON public.fulfillment_metadata FOR SELECT TO authenticated
  USING (
    (NOT is_pii AND NOT is_secret)
    AND (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(),'fulfillment.read',store_id))
  );

CREATE POLICY "fulfillment_metadata_select_sensitive" ON public.fulfillment_metadata FOR SELECT TO authenticated
  USING (
    (is_pii OR is_secret)
    AND (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(),'fulfillment.audit',store_id))
  );

CREATE POLICY "fulfillment_metadata_block_direct_write" ON public.fulfillment_metadata FOR ALL TO authenticated
  USING (false) WITH CHECK (false);

CREATE TRIGGER trg_fulfillment_metadata_updated BEFORE UPDATE ON public.fulfillment_metadata
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =====================================================================
-- RBAC: roles & permissions seed
-- =====================================================================
INSERT INTO public.roles (code, name, description, is_system) VALUES
  ('warehouse_operator','Warehouse Operator','Operador de armazém: executa picking e packing', true),
  ('logistics_manager','Logistics Manager','Gerente de logística: supervisiona fulfillment e shipments', true)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.permissions (code, module, description) VALUES
  ('fulfillment.read','fulfillment','Visualizar fulfillments'),
  ('fulfillment.create','fulfillment','Criar fulfillment'),
  ('fulfillment.allocate','fulfillment','Alocar warehouse e estoque'),
  ('fulfillment.pick','fulfillment','Executar e confirmar picking'),
  ('fulfillment.pack','fulfillment','Executar packing'),
  ('fulfillment.ship','fulfillment','Despachar e gerar shipment'),
  ('fulfillment.cancel','fulfillment','Cancelar fulfillment'),
  ('fulfillment.audit','fulfillment','Acesso a dados sensíveis e auditoria')
ON CONFLICT (code) DO NOTHING;

-- Assign permissions
DO $$
DECLARE
  r_super uuid; r_store uuid; r_wh uuid; r_log uuid;
  p record;
BEGIN
  SELECT id INTO r_super FROM public.roles WHERE code='super_admin';
  SELECT id INTO r_store FROM public.roles WHERE code='store_admin';
  SELECT id INTO r_wh    FROM public.roles WHERE code='warehouse_operator';
  SELECT id INTO r_log   FROM public.roles WHERE code='logistics_manager';

  FOR p IN SELECT id, code FROM public.permissions WHERE code LIKE 'fulfillment.%' LOOP
    IF r_super IS NOT NULL THEN
      INSERT INTO public.role_permissions(role_id, permission_id) VALUES (r_super, p.id) ON CONFLICT DO NOTHING;
    END IF;
    IF r_store IS NOT NULL THEN
      INSERT INTO public.role_permissions(role_id, permission_id) VALUES (r_store, p.id) ON CONFLICT DO NOTHING;
    END IF;
    IF r_log IS NOT NULL THEN
      INSERT INTO public.role_permissions(role_id, permission_id) VALUES (r_log, p.id) ON CONFLICT DO NOTHING;
    END IF;
    IF r_wh IS NOT NULL AND p.code IN ('fulfillment.read','fulfillment.allocate','fulfillment.pick','fulfillment.pack','fulfillment.ship') THEN
      INSERT INTO public.role_permissions(role_id, permission_id) VALUES (r_wh, p.id) ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
END $$;
