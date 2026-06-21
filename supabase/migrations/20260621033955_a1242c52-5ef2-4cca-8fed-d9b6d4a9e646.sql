
-- =====================================================================
-- FULFILLMENT & LOGISTICS — MIGRATION 2/3
-- Picking, Packing, Shipping & Tracking
-- =====================================================================

-- ENUMS -------------------------------------------------------------
CREATE TYPE public.pick_list_status AS ENUM (
  'draft','assigned','in_progress','completed','cancelled'
);
CREATE TYPE public.picking_strategy AS ENUM (
  'single_order','batch','wave','zone'
);
CREATE TYPE public.package_status AS ENUM (
  'open','sealed','voided'
);
CREATE TYPE public.shipment_status AS ENUM (
  'created','label_purchased','ready','dispatched','in_transit',
  'delivered','returned','lost','cancelled','failed'
);
CREATE TYPE public.shipping_label_format AS ENUM (
  'pdf','png','zpl','epl'
);
CREATE TYPE public.tracking_event_kind AS ENUM (
  'created','label_purchased','pickup_scheduled','picked_up','in_transit',
  'out_for_delivery','delivery_attempted','delivered','exception','returned','lost'
);
CREATE TYPE public.delivery_attempt_outcome AS ENUM (
  'success','customer_absent','address_issue','refused','damaged','rescheduled','other'
);

-- =====================================================================
-- TABLE: pick_lists
-- =====================================================================
CREATE TABLE public.pick_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  warehouse_id uuid NOT NULL REFERENCES public.warehouses(id) ON DELETE RESTRICT,
  code text NOT NULL,
  strategy public.picking_strategy NOT NULL DEFAULT 'single_order',
  status public.pick_list_status NOT NULL DEFAULT 'draft',
  assigned_to uuid REFERENCES auth.users(id),
  started_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  cancellation_reason text,
  total_items integer NOT NULL DEFAULT 0,
  completed_items integer NOT NULL DEFAULT 0,
  version integer NOT NULL DEFAULT 1,
  trace_id uuid,
  correlation_id uuid,
  causation_id uuid,
  schema_version integer NOT NULL DEFAULT 1,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(store_id, code)
);
CREATE INDEX idx_pick_lists_warehouse_status ON public.pick_lists(warehouse_id, status);
CREATE INDEX idx_pick_lists_assigned ON public.pick_lists(assigned_to) WHERE assigned_to IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pick_lists TO authenticated;
GRANT ALL ON public.pick_lists TO service_role;
ALTER TABLE public.pick_lists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pick_lists_select" ON public.pick_lists FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(),'fulfillment.read',store_id));
CREATE POLICY "pick_lists_block_direct_write" ON public.pick_lists FOR ALL TO authenticated
  USING (false) WITH CHECK (false);

CREATE TRIGGER trg_pick_lists_updated BEFORE UPDATE ON public.pick_lists
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.pick_lists_bump_version()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.version := OLD.version + 1; RETURN NEW; END $$;
CREATE TRIGGER trg_pick_lists_bump_version BEFORE UPDATE ON public.pick_lists
  FOR EACH ROW EXECUTE FUNCTION public.pick_lists_bump_version();

CREATE OR REPLACE FUNCTION public.pick_lists_status_transition_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_ok boolean;
BEGIN
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;
  v_ok := CASE OLD.status
    WHEN 'draft'       THEN NEW.status IN ('assigned','cancelled')
    WHEN 'assigned'    THEN NEW.status IN ('in_progress','cancelled')
    WHEN 'in_progress' THEN NEW.status IN ('completed','cancelled')
    ELSE false
  END;
  IF NOT v_ok THEN
    RAISE EXCEPTION 'Invalid pick_list status transition: % -> %', OLD.status, NEW.status
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_pick_lists_status_guard BEFORE UPDATE OF status ON public.pick_lists
  FOR EACH ROW EXECUTE FUNCTION public.pick_lists_status_transition_guard();

-- =====================================================================
-- TABLE: pick_list_items
-- =====================================================================
CREATE TABLE public.pick_list_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pick_list_id uuid NOT NULL REFERENCES public.pick_lists(id) ON DELETE CASCADE,
  fulfillment_id uuid NOT NULL REFERENCES public.fulfillments(id) ON DELETE CASCADE,
  fulfillment_item_id uuid NOT NULL REFERENCES public.fulfillment_items(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  sku text,
  bin_location text,
  quantity_requested numeric NOT NULL CHECK (quantity_requested > 0),
  quantity_picked numeric NOT NULL DEFAULT 0 CHECK (quantity_picked >= 0),
  picked_by uuid REFERENCES auth.users(id),
  picked_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_pick_list_items_list ON public.pick_list_items(pick_list_id);
CREATE INDEX idx_pick_list_items_fulfillment_item ON public.pick_list_items(fulfillment_item_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pick_list_items TO authenticated;
GRANT ALL ON public.pick_list_items TO service_role;
ALTER TABLE public.pick_list_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pick_list_items_select" ON public.pick_list_items FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(),'fulfillment.read',store_id));
CREATE POLICY "pick_list_items_block_direct_write" ON public.pick_list_items FOR ALL TO authenticated
  USING (false) WITH CHECK (false);

CREATE TRIGGER trg_pick_list_items_updated BEFORE UPDATE ON public.pick_list_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =====================================================================
-- TABLE: packages
-- =====================================================================
CREATE TABLE public.packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  fulfillment_id uuid NOT NULL REFERENCES public.fulfillments(id) ON DELETE CASCADE,
  code text NOT NULL,
  status public.package_status NOT NULL DEFAULT 'open',
  weight_g numeric,
  length_cm numeric,
  width_cm numeric,
  height_cm numeric,
  volume_cm3 numeric GENERATED ALWAYS AS (
    CASE WHEN length_cm IS NOT NULL AND width_cm IS NOT NULL AND height_cm IS NOT NULL
         THEN length_cm * width_cm * height_cm ELSE NULL END
  ) STORED,
  packed_by uuid REFERENCES auth.users(id),
  packed_at timestamptz,
  sealed_at timestamptz,
  voided_at timestamptz,
  void_reason text,
  version integer NOT NULL DEFAULT 1,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(store_id, code)
);
CREATE INDEX idx_packages_fulfillment ON public.packages(fulfillment_id);
CREATE INDEX idx_packages_store_status ON public.packages(store_id, status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.packages TO authenticated;
GRANT ALL ON public.packages TO service_role;
ALTER TABLE public.packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "packages_select" ON public.packages FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(),'fulfillment.read',store_id));
CREATE POLICY "packages_block_direct_write" ON public.packages FOR ALL TO authenticated
  USING (false) WITH CHECK (false);

CREATE TRIGGER trg_packages_updated BEFORE UPDATE ON public.packages
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.packages_bump_version()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.version := OLD.version + 1; RETURN NEW; END $$;
CREATE TRIGGER trg_packages_bump_version BEFORE UPDATE ON public.packages
  FOR EACH ROW EXECUTE FUNCTION public.packages_bump_version();

CREATE OR REPLACE FUNCTION public.packages_status_transition_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_ok boolean;
BEGIN
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;
  v_ok := CASE OLD.status
    WHEN 'open'   THEN NEW.status IN ('sealed','voided')
    WHEN 'sealed' THEN NEW.status IN ('voided')
    ELSE false
  END;
  IF NOT v_ok THEN
    RAISE EXCEPTION 'Invalid package status transition: % -> %', OLD.status, NEW.status
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_packages_status_guard BEFORE UPDATE OF status ON public.packages
  FOR EACH ROW EXECUTE FUNCTION public.packages_status_transition_guard();

-- =====================================================================
-- TABLE: package_items
-- =====================================================================
CREATE TABLE public.package_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES public.packages(id) ON DELETE CASCADE,
  fulfillment_item_id uuid NOT NULL REFERENCES public.fulfillment_items(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  quantity numeric NOT NULL CHECK (quantity > 0),
  serial_numbers jsonb NOT NULL DEFAULT '[]'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_package_items_package ON public.package_items(package_id);
CREATE INDEX idx_package_items_fulfillment_item ON public.package_items(fulfillment_item_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.package_items TO authenticated;
GRANT ALL ON public.package_items TO service_role;
ALTER TABLE public.package_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "package_items_select" ON public.package_items FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(),'fulfillment.read',store_id));
CREATE POLICY "package_items_block_direct_write" ON public.package_items FOR ALL TO authenticated
  USING (false) WITH CHECK (false);

-- =====================================================================
-- TABLE: shipments
-- =====================================================================
CREATE TABLE public.shipments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  fulfillment_id uuid NOT NULL REFERENCES public.fulfillments(id) ON DELETE CASCADE,
  code text NOT NULL,
  status public.shipment_status NOT NULL DEFAULT 'created',
  carrier_code text,
  service_code text,
  service_name text,
  tracking_number text,
  tracking_url text,
  declared_value numeric,
  currency text NOT NULL DEFAULT 'BRL',
  shipping_cost numeric,
  insurance_cost numeric,
  weight_g numeric,
  ship_from jsonb NOT NULL DEFAULT '{}'::jsonb,
  ship_to jsonb NOT NULL DEFAULT '{}'::jsonb,
  dispatched_at timestamptz,
  estimated_delivery_at timestamptz,
  delivered_at timestamptz,
  returned_at timestamptz,
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
  UNIQUE(store_id, code)
);
CREATE INDEX idx_shipments_fulfillment ON public.shipments(fulfillment_id);
CREATE INDEX idx_shipments_store_status ON public.shipments(store_id, status);
CREATE INDEX idx_shipments_carrier ON public.shipments(carrier_code, status);
CREATE INDEX idx_shipments_tracking ON public.shipments(tracking_number) WHERE tracking_number IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.shipments TO authenticated;
GRANT ALL ON public.shipments TO service_role;
ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shipments_select" ON public.shipments FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(),'fulfillment.read',store_id));
CREATE POLICY "shipments_block_direct_write" ON public.shipments FOR ALL TO authenticated
  USING (false) WITH CHECK (false);

CREATE TRIGGER trg_shipments_updated BEFORE UPDATE ON public.shipments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.shipments_bump_version()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.version := OLD.version + 1; RETURN NEW; END $$;
CREATE TRIGGER trg_shipments_bump_version BEFORE UPDATE ON public.shipments
  FOR EACH ROW EXECUTE FUNCTION public.shipments_bump_version();

CREATE OR REPLACE FUNCTION public.shipments_status_transition_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_ok boolean;
BEGIN
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;
  v_ok := CASE OLD.status
    WHEN 'created'         THEN NEW.status IN ('label_purchased','ready','cancelled','failed')
    WHEN 'label_purchased' THEN NEW.status IN ('ready','dispatched','cancelled','failed')
    WHEN 'ready'           THEN NEW.status IN ('dispatched','cancelled','failed')
    WHEN 'dispatched'      THEN NEW.status IN ('in_transit','delivered','returned','lost','failed')
    WHEN 'in_transit'      THEN NEW.status IN ('delivered','returned','lost','failed')
    WHEN 'delivered'       THEN NEW.status IN ('returned')
    WHEN 'failed'          THEN NEW.status IN ('created')
    ELSE false
  END;
  IF NOT v_ok THEN
    RAISE EXCEPTION 'Invalid shipment status transition: % -> %', OLD.status, NEW.status
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_shipments_status_guard BEFORE UPDATE OF status ON public.shipments
  FOR EACH ROW EXECUTE FUNCTION public.shipments_status_transition_guard();

CREATE OR REPLACE FUNCTION public.tg_shipments_enqueue_outbox()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_event_type text; v_payload jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_event_type := 'shipment.created';
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    v_event_type := 'shipment.' || NEW.status::text;
  ELSE
    RETURN NEW;
  END IF;
  v_payload := jsonb_build_object(
    'shipment_id', NEW.id,
    'store_id', NEW.store_id,
    'fulfillment_id', NEW.fulfillment_id,
    'code', NEW.code,
    'carrier_code', NEW.carrier_code,
    'tracking_number', NEW.tracking_number,
    'status', NEW.status,
    'version', NEW.version,
    'schema_version', NEW.schema_version
  );
  PERFORM public.enqueue_outbox_event(
    NEW.store_id, v_event_type, 'shipment', NEW.id, v_payload,
    NEW.trace_id, NEW.correlation_id, NEW.causation_id
  );
  RETURN NEW;
END $$;
CREATE TRIGGER trg_shipments_outbox
  AFTER INSERT OR UPDATE OF status ON public.shipments
  FOR EACH ROW EXECUTE FUNCTION public.tg_shipments_enqueue_outbox();

-- =====================================================================
-- TABLE: shipment_packages (1 shipment : N packages; 1 package : 1 shipment)
-- =====================================================================
CREATE TABLE public.shipment_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id uuid NOT NULL REFERENCES public.shipments(id) ON DELETE CASCADE,
  package_id uuid NOT NULL REFERENCES public.packages(id) ON DELETE RESTRICT,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(package_id)
);
CREATE INDEX idx_shipment_packages_shipment ON public.shipment_packages(shipment_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.shipment_packages TO authenticated;
GRANT ALL ON public.shipment_packages TO service_role;
ALTER TABLE public.shipment_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shipment_packages_select" ON public.shipment_packages FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(),'fulfillment.read',store_id));
CREATE POLICY "shipment_packages_block_direct_write" ON public.shipment_packages FOR ALL TO authenticated
  USING (false) WITH CHECK (false);

-- =====================================================================
-- TABLE: shipping_labels
-- =====================================================================
CREATE TABLE public.shipping_labels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id uuid NOT NULL REFERENCES public.shipments(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  format public.shipping_label_format NOT NULL DEFAULT 'pdf',
  url text,
  asset_id uuid REFERENCES public.assets(id) ON DELETE SET NULL,
  cost numeric,
  currency text DEFAULT 'BRL',
  carrier_label_id text,
  purchased_at timestamptz NOT NULL DEFAULT now(),
  voided_at timestamptz,
  void_reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_shipping_labels_shipment ON public.shipping_labels(shipment_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.shipping_labels TO authenticated;
GRANT ALL ON public.shipping_labels TO service_role;
ALTER TABLE public.shipping_labels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shipping_labels_select" ON public.shipping_labels FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(),'fulfillment.read',store_id));
CREATE POLICY "shipping_labels_block_direct_write" ON public.shipping_labels FOR ALL TO authenticated
  USING (false) WITH CHECK (false);

-- =====================================================================
-- TABLE: tracking_events (append-only)
-- =====================================================================
CREATE TABLE public.tracking_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id uuid NOT NULL REFERENCES public.shipments(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  kind public.tracking_event_kind NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  location text,
  description text,
  source text NOT NULL DEFAULT 'carrier',
  raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  trace_id uuid,
  correlation_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_tracking_events_shipment ON public.tracking_events(shipment_id, occurred_at DESC);
CREATE INDEX idx_tracking_events_store ON public.tracking_events(store_id, occurred_at DESC);

GRANT SELECT ON public.tracking_events TO authenticated;
GRANT ALL ON public.tracking_events TO service_role;
ALTER TABLE public.tracking_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tracking_events_select" ON public.tracking_events FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(),'fulfillment.read',store_id));

CREATE OR REPLACE FUNCTION public.tracking_events_append_only()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN RAISE EXCEPTION 'tracking_events is append-only'; END $$;
CREATE TRIGGER trg_tracking_events_append_only
  BEFORE UPDATE OR DELETE ON public.tracking_events
  FOR EACH ROW EXECUTE FUNCTION public.tracking_events_append_only();

-- =====================================================================
-- TABLE: delivery_attempts (append-only)
-- =====================================================================
CREATE TABLE public.delivery_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id uuid NOT NULL REFERENCES public.shipments(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  attempt_number integer NOT NULL CHECK (attempt_number > 0),
  outcome public.delivery_attempt_outcome NOT NULL,
  attempted_at timestamptz NOT NULL DEFAULT now(),
  signed_by text,
  proof_asset_id uuid REFERENCES public.assets(id) ON DELETE SET NULL,
  notes text,
  raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  trace_id uuid,
  correlation_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(shipment_id, attempt_number)
);
CREATE INDEX idx_delivery_attempts_shipment ON public.delivery_attempts(shipment_id, attempted_at DESC);

GRANT SELECT ON public.delivery_attempts TO authenticated;
GRANT ALL ON public.delivery_attempts TO service_role;
ALTER TABLE public.delivery_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "delivery_attempts_select" ON public.delivery_attempts FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(),'fulfillment.read',store_id));

CREATE OR REPLACE FUNCTION public.delivery_attempts_append_only()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN RAISE EXCEPTION 'delivery_attempts is append-only'; END $$;
CREATE TRIGGER trg_delivery_attempts_append_only
  BEFORE UPDATE OR DELETE ON public.delivery_attempts
  FOR EACH ROW EXECUTE FUNCTION public.delivery_attempts_append_only();
