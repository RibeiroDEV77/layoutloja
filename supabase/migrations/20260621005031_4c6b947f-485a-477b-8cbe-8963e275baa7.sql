
-- ============================================================
-- FASE 5.2 — Cart, Pricing, Stock Reservation, Coupons, Shipping
-- ============================================================

-- Enums
DO $$ BEGIN
  CREATE TYPE public.cart_status AS ENUM ('active','merged','abandoned','converted','expired');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.cart_price_source AS ENUM ('catalog','price_list','promo','coupon','manual');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.reservation_status AS ENUM ('active','released','consumed','expired');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.reservation_ledger_kind AS ENUM ('reserve','release','consume','expire','extend');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.coupon_type AS ENUM ('percent','fixed','free_shipping');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.coupon_scope AS ENUM ('cart','shipping','category','product','collection');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.coupon_ledger_kind AS ENUM ('applied','removed','validated','rejected','expired','limit_reached','consumed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.shipping_method_kind AS ENUM ('carrier','flat','free','pickup','table');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.cart_timeline_event AS ENUM (
    'created','item_added','item_removed','qty_changed','price_changed',
    'coupon_applied','coupon_removed','shipping_calculated','shipping_selected',
    'address_set','merged','abandoned','recovered','converted','expired',
    'reservation_created','reservation_released','reservation_extended'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- CARTS
-- ============================================================
CREATE TABLE public.carts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  session_token text,
  status public.cart_status NOT NULL DEFAULT 'active',
  currency text NOT NULL DEFAULT 'BRL',
  customer_group_id uuid REFERENCES public.customer_groups(id) ON DELETE SET NULL,
  price_list_id uuid REFERENCES public.price_lists(id) ON DELETE SET NULL,
  subtotal numeric(14,2) NOT NULL DEFAULT 0,
  discount_total numeric(14,2) NOT NULL DEFAULT 0,
  shipping_total numeric(14,2) NOT NULL DEFAULT 0,
  tax_total numeric(14,2) NOT NULL DEFAULT 0,
  total numeric(14,2) NOT NULL DEFAULT 0,
  items_count int NOT NULL DEFAULT 0,
  selected_shipping_quote_id uuid,
  shipping_address_id uuid REFERENCES public.customer_addresses(id) ON DELETE SET NULL,
  billing_address_id uuid REFERENCES public.customer_addresses(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  expires_at timestamptz,
  merged_into_cart_id uuid REFERENCES public.carts(id) ON DELETE SET NULL,
  converted_order_id uuid,
  last_activity_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT carts_owner_chk CHECK (customer_id IS NOT NULL OR session_token IS NOT NULL)
);
CREATE INDEX idx_carts_store ON public.carts(store_id);
CREATE INDEX idx_carts_customer ON public.carts(customer_id) WHERE customer_id IS NOT NULL;
CREATE INDEX idx_carts_session_token ON public.carts(session_token) WHERE session_token IS NOT NULL;
CREATE INDEX idx_carts_status ON public.carts(status);
CREATE INDEX idx_carts_expires_at ON public.carts(expires_at) WHERE status = 'active';
CREATE UNIQUE INDEX uq_carts_active_customer ON public.carts(store_id, customer_id) WHERE status = 'active' AND customer_id IS NOT NULL;
CREATE UNIQUE INDEX uq_carts_active_session ON public.carts(store_id, session_token) WHERE status = 'active' AND session_token IS NOT NULL AND customer_id IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.carts TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.carts TO anon;
GRANT ALL ON public.carts TO service_role;

ALTER TABLE public.carts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Carts: own customer can read"
ON public.carts FOR SELECT TO authenticated
USING (
  is_super_admin(auth.uid())
  OR has_permission(auth.uid(), 'carts.read', store_id)
  OR (customer_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.customers c WHERE c.id = customer_id AND c.auth_user_id = auth.uid()
  ))
);

CREATE POLICY "Carts: anon read by session token"
ON public.carts FOR SELECT TO anon
USING (session_token IS NOT NULL AND customer_id IS NULL);

CREATE POLICY "Carts: insert by self or session"
ON public.carts FOR INSERT TO authenticated
WITH CHECK (
  is_super_admin(auth.uid())
  OR has_permission(auth.uid(), 'carts.write', store_id)
  OR (customer_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.customers c WHERE c.id = customer_id AND c.auth_user_id = auth.uid()
  ))
);

CREATE POLICY "Carts: anon insert"
ON public.carts FOR INSERT TO anon
WITH CHECK (session_token IS NOT NULL AND customer_id IS NULL);

CREATE POLICY "Carts: update own"
ON public.carts FOR UPDATE TO authenticated
USING (
  is_super_admin(auth.uid())
  OR has_permission(auth.uid(), 'carts.write', store_id)
  OR (customer_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.customers c WHERE c.id = customer_id AND c.auth_user_id = auth.uid()
  ))
);

CREATE POLICY "Carts: anon update by token"
ON public.carts FOR UPDATE TO anon
USING (session_token IS NOT NULL AND customer_id IS NULL);

CREATE POLICY "Carts: admin delete"
ON public.carts FOR DELETE TO authenticated
USING (is_super_admin(auth.uid()) OR has_permission(auth.uid(), 'carts.write', store_id));

CREATE TRIGGER trg_carts_updated_at BEFORE UPDATE ON public.carts
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- helper: cart_store_id
CREATE OR REPLACE FUNCTION public.cart_store_id(_cart_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT store_id FROM public.carts WHERE id = _cart_id
$$;

-- helper: user is cart owner
CREATE OR REPLACE FUNCTION public.is_cart_owner(_cart_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.carts c
    LEFT JOIN public.customers cu ON cu.id = c.customer_id
    WHERE c.id = _cart_id
      AND (cu.auth_user_id = auth.uid()
           OR is_super_admin(auth.uid())
           OR has_permission(auth.uid(), 'carts.write', c.store_id))
  )
$$;

-- ============================================================
-- CART ITEMS
-- ============================================================
CREATE TABLE public.cart_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id uuid NOT NULL REFERENCES public.carts(id) ON DELETE CASCADE,
  variant_id uuid NOT NULL REFERENCES public.product_variants(id) ON DELETE RESTRICT,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  qty int NOT NULL CHECK (qty > 0),
  list_price numeric(14,2) NOT NULL DEFAULT 0,
  unit_price numeric(14,2) NOT NULL DEFAULT 0,
  discount_amount numeric(14,2) NOT NULL DEFAULT 0,
  line_total numeric(14,2) NOT NULL DEFAULT 0,
  price_source public.cart_price_source NOT NULL DEFAULT 'catalog',
  price_list_item_id uuid REFERENCES public.price_list_items(id) ON DELETE SET NULL,
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cart_id, variant_id)
);
CREATE INDEX idx_cart_items_cart ON public.cart_items(cart_id);
CREATE INDEX idx_cart_items_variant ON public.cart_items(variant_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cart_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cart_items TO anon;
GRANT ALL ON public.cart_items TO service_role;

ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Cart items: read via cart"
ON public.cart_items FOR SELECT TO authenticated, anon
USING (EXISTS (SELECT 1 FROM public.carts c WHERE c.id = cart_id));

CREATE POLICY "Cart items: write via cart owner"
ON public.cart_items FOR ALL TO authenticated, anon
USING (EXISTS (SELECT 1 FROM public.carts c WHERE c.id = cart_id))
WITH CHECK (EXISTS (SELECT 1 FROM public.carts c WHERE c.id = cart_id));

CREATE TRIGGER trg_cart_items_updated_at BEFORE UPDATE ON public.cart_items
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- CART SNAPSHOTS (imutáveis)
-- ============================================================
CREATE TABLE public.cart_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id uuid NOT NULL REFERENCES public.carts(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  reason text NOT NULL,
  payload jsonb NOT NULL,
  totals jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_cart_snapshots_cart ON public.cart_snapshots(cart_id, created_at DESC);

GRANT SELECT, INSERT ON public.cart_snapshots TO authenticated;
GRANT SELECT, INSERT ON public.cart_snapshots TO anon;
GRANT ALL ON public.cart_snapshots TO service_role;

ALTER TABLE public.cart_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Cart snapshots: read via cart"
ON public.cart_snapshots FOR SELECT TO authenticated, anon
USING (EXISTS (SELECT 1 FROM public.carts c WHERE c.id = cart_id));
CREATE POLICY "Cart snapshots: insert via cart"
ON public.cart_snapshots FOR INSERT TO authenticated, anon
WITH CHECK (EXISTS (SELECT 1 FROM public.carts c WHERE c.id = cart_id));

-- ============================================================
-- CART TIMELINE
-- ============================================================
CREATE TABLE public.cart_timeline (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id uuid NOT NULL REFERENCES public.carts(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  event_type public.cart_timeline_event NOT NULL,
  actor_user_id uuid,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_cart_timeline_cart ON public.cart_timeline(cart_id, created_at DESC);
CREATE INDEX idx_cart_timeline_event ON public.cart_timeline(event_type);

GRANT SELECT, INSERT ON public.cart_timeline TO authenticated;
GRANT SELECT, INSERT ON public.cart_timeline TO anon;
GRANT ALL ON public.cart_timeline TO service_role;

ALTER TABLE public.cart_timeline ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Cart timeline: read via cart"
ON public.cart_timeline FOR SELECT TO authenticated, anon
USING (EXISTS (SELECT 1 FROM public.carts c WHERE c.id = cart_id));
CREATE POLICY "Cart timeline: insert via cart"
ON public.cart_timeline FOR INSERT TO authenticated, anon
WITH CHECK (EXISTS (SELECT 1 FROM public.carts c WHERE c.id = cart_id));

CREATE OR REPLACE FUNCTION public.record_cart_timeline_event(
  _cart_id uuid, _event_type public.cart_timeline_event, _payload jsonb DEFAULT '{}'::jsonb
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_store_id uuid; v_id uuid;
BEGIN
  SELECT store_id INTO v_store_id FROM public.carts WHERE id = _cart_id;
  IF v_store_id IS NULL THEN RAISE EXCEPTION 'Cart % not found', _cart_id; END IF;
  INSERT INTO public.cart_timeline(cart_id, store_id, event_type, actor_user_id, payload)
  VALUES (_cart_id, v_store_id, _event_type, auth.uid(), _payload)
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

-- ============================================================
-- STOCK RESERVATIONS
-- ============================================================
CREATE TABLE public.stock_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  cart_id uuid REFERENCES public.carts(id) ON DELETE CASCADE,
  cart_item_id uuid REFERENCES public.cart_items(id) ON DELETE CASCADE,
  order_id uuid,
  variant_id uuid NOT NULL REFERENCES public.product_variants(id) ON DELETE RESTRICT,
  warehouse_id uuid REFERENCES public.warehouses(id) ON DELETE SET NULL,
  qty int NOT NULL CHECK (qty > 0),
  status public.reservation_status NOT NULL DEFAULT 'active',
  expires_at timestamptz NOT NULL,
  released_at timestamptz,
  consumed_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_stock_reservations_cart ON public.stock_reservations(cart_id) WHERE cart_id IS NOT NULL;
CREATE INDEX idx_stock_reservations_variant ON public.stock_reservations(variant_id);
CREATE INDEX idx_stock_reservations_active_expires ON public.stock_reservations(expires_at) WHERE status = 'active';

GRANT SELECT, INSERT, UPDATE ON public.stock_reservations TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.stock_reservations TO anon;
GRANT ALL ON public.stock_reservations TO service_role;

ALTER TABLE public.stock_reservations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Reservations: read by store ops or cart"
ON public.stock_reservations FOR SELECT TO authenticated, anon
USING (
  EXISTS (SELECT 1 FROM public.carts c WHERE c.id = cart_id)
  OR (auth.uid() IS NOT NULL AND (is_super_admin(auth.uid()) OR has_permission(auth.uid(), 'stock.read', store_id)))
);
CREATE POLICY "Reservations: insert via cart"
ON public.stock_reservations FOR INSERT TO authenticated, anon
WITH CHECK (EXISTS (SELECT 1 FROM public.carts c WHERE c.id = cart_id));
CREATE POLICY "Reservations: update via cart or admin"
ON public.stock_reservations FOR UPDATE TO authenticated, anon
USING (
  EXISTS (SELECT 1 FROM public.carts c WHERE c.id = cart_id)
  OR (auth.uid() IS NOT NULL AND (is_super_admin(auth.uid()) OR has_permission(auth.uid(), 'stock.write', store_id)))
);

CREATE TRIGGER trg_stock_reservations_updated_at BEFORE UPDATE ON public.stock_reservations
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- STOCK RESERVATION LEDGER
-- ============================================================
CREATE TABLE public.stock_reservation_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id uuid NOT NULL REFERENCES public.stock_reservations(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  kind public.reservation_ledger_kind NOT NULL,
  qty int NOT NULL,
  actor_user_id uuid,
  reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_res_ledger_reservation ON public.stock_reservation_ledger(reservation_id, created_at);

GRANT SELECT, INSERT ON public.stock_reservation_ledger TO authenticated;
GRANT SELECT, INSERT ON public.stock_reservation_ledger TO anon;
GRANT ALL ON public.stock_reservation_ledger TO service_role;

ALTER TABLE public.stock_reservation_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Res ledger: read via reservation"
ON public.stock_reservation_ledger FOR SELECT TO authenticated, anon
USING (EXISTS (SELECT 1 FROM public.stock_reservations r WHERE r.id = reservation_id));
CREATE POLICY "Res ledger: insert via reservation"
ON public.stock_reservation_ledger FOR INSERT TO authenticated, anon
WITH CHECK (EXISTS (SELECT 1 FROM public.stock_reservations r WHERE r.id = reservation_id));

-- ============================================================
-- COUPONS
-- ============================================================
CREATE TABLE public.coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  description text,
  type public.coupon_type NOT NULL,
  scope public.coupon_scope NOT NULL DEFAULT 'cart',
  value numeric(14,4) NOT NULL DEFAULT 0,
  min_subtotal numeric(14,2),
  max_discount numeric(14,2),
  usage_limit_total int,
  usage_limit_per_customer int,
  usage_count int NOT NULL DEFAULT 0,
  valid_from timestamptz,
  valid_until timestamptz,
  stackable boolean NOT NULL DEFAULT false,
  customer_group_id uuid REFERENCES public.customer_groups(id) ON DELETE SET NULL,
  applies_to_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, code)
);
CREATE INDEX idx_coupons_store_active ON public.coupons(store_id, active);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.coupons TO authenticated;
GRANT SELECT ON public.coupons TO anon;
GRANT ALL ON public.coupons TO service_role;

ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Coupons: public read active"
ON public.coupons FOR SELECT TO anon, authenticated
USING (active = true);
CREATE POLICY "Coupons: manage"
ON public.coupons FOR ALL TO authenticated
USING (is_super_admin(auth.uid()) OR has_permission(auth.uid(), 'pricing.manage', store_id))
WITH CHECK (is_super_admin(auth.uid()) OR has_permission(auth.uid(), 'pricing.manage', store_id));

CREATE TRIGGER trg_coupons_updated_at BEFORE UPDATE ON public.coupons
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- CART_COUPONS
CREATE TABLE public.cart_coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id uuid NOT NULL REFERENCES public.carts(id) ON DELETE CASCADE,
  coupon_id uuid NOT NULL REFERENCES public.coupons(id) ON DELETE CASCADE,
  applied_value numeric(14,2) NOT NULL DEFAULT 0,
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cart_id, coupon_id)
);
CREATE INDEX idx_cart_coupons_cart ON public.cart_coupons(cart_id);

GRANT SELECT, INSERT, DELETE ON public.cart_coupons TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.cart_coupons TO anon;
GRANT ALL ON public.cart_coupons TO service_role;

ALTER TABLE public.cart_coupons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Cart coupons: via cart"
ON public.cart_coupons FOR ALL TO authenticated, anon
USING (EXISTS (SELECT 1 FROM public.carts c WHERE c.id = cart_id))
WITH CHECK (EXISTS (SELECT 1 FROM public.carts c WHERE c.id = cart_id));

-- COUPON REDEMPTIONS
CREATE TABLE public.coupon_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id uuid NOT NULL REFERENCES public.coupons(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  cart_id uuid REFERENCES public.carts(id) ON DELETE SET NULL,
  order_id uuid,
  amount numeric(14,2) NOT NULL DEFAULT 0,
  redeemed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_coupon_redemptions_coupon ON public.coupon_redemptions(coupon_id);
CREATE INDEX idx_coupon_redemptions_customer ON public.coupon_redemptions(customer_id);

GRANT SELECT, INSERT ON public.coupon_redemptions TO authenticated;
GRANT SELECT, INSERT ON public.coupon_redemptions TO anon;
GRANT ALL ON public.coupon_redemptions TO service_role;

ALTER TABLE public.coupon_redemptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Redemptions: read store ops or self"
ON public.coupon_redemptions FOR SELECT TO authenticated
USING (
  is_super_admin(auth.uid())
  OR has_permission(auth.uid(), 'pricing.manage', store_id)
  OR (customer_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.customers c WHERE c.id = customer_id AND c.auth_user_id = auth.uid()
  ))
);
CREATE POLICY "Redemptions: insert via cart"
ON public.coupon_redemptions FOR INSERT TO authenticated, anon
WITH CHECK (cart_id IS NULL OR EXISTS (SELECT 1 FROM public.carts c WHERE c.id = cart_id));

-- COUPON LEDGER
CREATE TABLE public.coupon_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id uuid REFERENCES public.coupons(id) ON DELETE CASCADE,
  coupon_code text,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  cart_id uuid REFERENCES public.carts(id) ON DELETE SET NULL,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  kind public.coupon_ledger_kind NOT NULL,
  amount numeric(14,2),
  reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_coupon_ledger_coupon ON public.coupon_ledger(coupon_id, created_at DESC);
CREATE INDEX idx_coupon_ledger_cart ON public.coupon_ledger(cart_id);

GRANT SELECT, INSERT ON public.coupon_ledger TO authenticated;
GRANT SELECT, INSERT ON public.coupon_ledger TO anon;
GRANT ALL ON public.coupon_ledger TO service_role;

ALTER TABLE public.coupon_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Coupon ledger: read store ops or via cart"
ON public.coupon_ledger FOR SELECT TO authenticated, anon
USING (
  (cart_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.carts c WHERE c.id = cart_id))
  OR (auth.uid() IS NOT NULL AND (is_super_admin(auth.uid()) OR has_permission(auth.uid(), 'pricing.manage', store_id)))
);
CREATE POLICY "Coupon ledger: insert"
ON public.coupon_ledger FOR INSERT TO authenticated, anon
WITH CHECK (
  (cart_id IS NULL OR EXISTS (SELECT 1 FROM public.carts c WHERE c.id = cart_id))
);

-- ============================================================
-- SHIPPING
-- ============================================================
CREATE TABLE public.shipping_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name text NOT NULL,
  country text NOT NULL DEFAULT 'BR',
  states text[] NOT NULL DEFAULT '{}'::text[],
  active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_shipping_zones_store ON public.shipping_zones(store_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.shipping_zones TO authenticated;
GRANT SELECT ON public.shipping_zones TO anon;
GRANT ALL ON public.shipping_zones TO service_role;

ALTER TABLE public.shipping_zones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Shipping zones: public read active"
ON public.shipping_zones FOR SELECT TO authenticated, anon USING (active = true);
CREATE POLICY "Shipping zones: manage"
ON public.shipping_zones FOR ALL TO authenticated
USING (is_super_admin(auth.uid()) OR has_permission(auth.uid(), 'shipping.manage', store_id))
WITH CHECK (is_super_admin(auth.uid()) OR has_permission(auth.uid(), 'shipping.manage', store_id));

CREATE TRIGGER trg_shipping_zones_updated_at BEFORE UPDATE ON public.shipping_zones
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- POSTAL RANGES
CREATE TABLE public.shipping_zone_postal_ranges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_id uuid NOT NULL REFERENCES public.shipping_zones(id) ON DELETE CASCADE,
  postal_from text NOT NULL,
  postal_to text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_shipping_zone_postal_zone ON public.shipping_zone_postal_ranges(zone_id);
CREATE INDEX idx_shipping_zone_postal_range ON public.shipping_zone_postal_ranges(postal_from, postal_to);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.shipping_zone_postal_ranges TO authenticated;
GRANT SELECT ON public.shipping_zone_postal_ranges TO anon;
GRANT ALL ON public.shipping_zone_postal_ranges TO service_role;

ALTER TABLE public.shipping_zone_postal_ranges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Postal ranges: public read"
ON public.shipping_zone_postal_ranges FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "Postal ranges: manage via zone"
ON public.shipping_zone_postal_ranges FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.shipping_zones z WHERE z.id = zone_id
  AND (is_super_admin(auth.uid()) OR has_permission(auth.uid(), 'shipping.manage', z.store_id))))
WITH CHECK (EXISTS (SELECT 1 FROM public.shipping_zones z WHERE z.id = zone_id
  AND (is_super_admin(auth.uid()) OR has_permission(auth.uid(), 'shipping.manage', z.store_id))));

-- METHODS
CREATE TABLE public.shipping_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  kind public.shipping_method_kind NOT NULL,
  carrier text,
  estimated_days_min int,
  estimated_days_max int,
  active boolean NOT NULL DEFAULT true,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shipping_methods TO authenticated;
GRANT SELECT ON public.shipping_methods TO anon;
GRANT ALL ON public.shipping_methods TO service_role;

ALTER TABLE public.shipping_methods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Shipping methods: public read active"
ON public.shipping_methods FOR SELECT TO authenticated, anon USING (active = true);
CREATE POLICY "Shipping methods: manage"
ON public.shipping_methods FOR ALL TO authenticated
USING (is_super_admin(auth.uid()) OR has_permission(auth.uid(), 'shipping.manage', store_id))
WITH CHECK (is_super_admin(auth.uid()) OR has_permission(auth.uid(), 'shipping.manage', store_id));

CREATE TRIGGER trg_shipping_methods_updated_at BEFORE UPDATE ON public.shipping_methods
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RATES
CREATE TABLE public.shipping_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  zone_id uuid NOT NULL REFERENCES public.shipping_zones(id) ON DELETE CASCADE,
  method_id uuid NOT NULL REFERENCES public.shipping_methods(id) ON DELETE CASCADE,
  min_weight_g int NOT NULL DEFAULT 0,
  max_weight_g int,
  min_subtotal numeric(14,2),
  max_subtotal numeric(14,2),
  price numeric(14,2) NOT NULL,
  free_above_subtotal numeric(14,2),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_shipping_rates_lookup ON public.shipping_rates(zone_id, method_id, active);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.shipping_rates TO authenticated;
GRANT SELECT ON public.shipping_rates TO anon;
GRANT ALL ON public.shipping_rates TO service_role;

ALTER TABLE public.shipping_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Shipping rates: public read"
ON public.shipping_rates FOR SELECT TO authenticated, anon USING (active = true);
CREATE POLICY "Shipping rates: manage"
ON public.shipping_rates FOR ALL TO authenticated
USING (is_super_admin(auth.uid()) OR has_permission(auth.uid(), 'shipping.manage', store_id))
WITH CHECK (is_super_admin(auth.uid()) OR has_permission(auth.uid(), 'shipping.manage', store_id));

CREATE TRIGGER trg_shipping_rates_updated_at BEFORE UPDATE ON public.shipping_rates
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- QUOTES
CREATE TABLE public.shipping_quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id uuid NOT NULL REFERENCES public.carts(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  method_id uuid REFERENCES public.shipping_methods(id) ON DELETE SET NULL,
  method_code text NOT NULL,
  method_name text NOT NULL,
  carrier text,
  price numeric(14,2) NOT NULL,
  estimated_days_min int,
  estimated_days_max int,
  postal_code text,
  weight_g int,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  selected boolean NOT NULL DEFAULT false,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_shipping_quotes_cart ON public.shipping_quotes(cart_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.shipping_quotes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shipping_quotes TO anon;
GRANT ALL ON public.shipping_quotes TO service_role;

ALTER TABLE public.shipping_quotes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Shipping quotes: via cart"
ON public.shipping_quotes FOR ALL TO authenticated, anon
USING (EXISTS (SELECT 1 FROM public.carts c WHERE c.id = cart_id))
WITH CHECK (EXISTS (SELECT 1 FROM public.carts c WHERE c.id = cart_id));

-- SHIPPING SNAPSHOTS
CREATE TABLE public.shipping_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id uuid NOT NULL REFERENCES public.carts(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  quote_id uuid REFERENCES public.shipping_quotes(id) ON DELETE SET NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_shipping_snapshots_cart ON public.shipping_snapshots(cart_id, created_at DESC);

GRANT SELECT, INSERT ON public.shipping_snapshots TO authenticated;
GRANT SELECT, INSERT ON public.shipping_snapshots TO anon;
GRANT ALL ON public.shipping_snapshots TO service_role;

ALTER TABLE public.shipping_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Shipping snapshots: via cart"
ON public.shipping_snapshots FOR ALL TO authenticated, anon
USING (EXISTS (SELECT 1 FROM public.carts c WHERE c.id = cart_id))
WITH CHECK (EXISTS (SELECT 1 FROM public.carts c WHERE c.id = cart_id));

-- ============================================================
-- BUSINESS FUNCTIONS
-- ============================================================

-- Recalcula totals do carrinho
CREATE OR REPLACE FUNCTION public.cart_recalculate(_cart_id uuid)
RETURNS public.carts LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_cart public.carts%ROWTYPE;
  v_subtotal numeric(14,2) := 0;
  v_items int := 0;
  v_discount numeric(14,2) := 0;
  v_shipping numeric(14,2) := 0;
BEGIN
  SELECT * INTO v_cart FROM public.carts WHERE id = _cart_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cart % not found', _cart_id; END IF;

  SELECT COALESCE(SUM(line_total),0), COALESCE(SUM(qty),0)
    INTO v_subtotal, v_items
    FROM public.cart_items WHERE cart_id = _cart_id;

  SELECT COALESCE(SUM(applied_value),0) INTO v_discount
    FROM public.cart_coupons WHERE cart_id = _cart_id;

  SELECT COALESCE(price,0) INTO v_shipping
    FROM public.shipping_quotes WHERE cart_id = _cart_id AND selected = true
    ORDER BY created_at DESC LIMIT 1;

  UPDATE public.carts SET
    subtotal = v_subtotal,
    discount_total = v_discount,
    shipping_total = COALESCE(v_shipping,0),
    total = GREATEST(0, v_subtotal - v_discount) + COALESCE(v_shipping,0),
    items_count = v_items,
    last_activity_at = now()
  WHERE id = _cart_id
  RETURNING * INTO v_cart;

  RETURN v_cart;
END $$;

-- Aplica price_list/customer_group recalculando unit_price dos itens
CREATE OR REPLACE FUNCTION public.cart_apply_pricing(_cart_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r record;
  v_price_list_id uuid;
  v_unit numeric(14,2);
  v_list numeric(14,2);
  v_source public.cart_price_source;
  v_pli_id uuid;
BEGIN
  SELECT price_list_id INTO v_price_list_id FROM public.carts WHERE id = _cart_id;
  FOR r IN SELECT ci.*, pv.price AS variant_price
           FROM public.cart_items ci
           JOIN public.product_variants pv ON pv.id = ci.variant_id
           WHERE ci.cart_id = _cart_id LOOP
    v_list := COALESCE(r.variant_price, 0);
    v_unit := v_list;
    v_source := 'catalog';
    v_pli_id := NULL;
    IF v_price_list_id IS NOT NULL THEN
      SELECT id, price INTO v_pli_id, v_unit
      FROM public.price_list_items
      WHERE price_list_id = v_price_list_id AND variant_id = r.variant_id
      LIMIT 1;
      IF v_pli_id IS NOT NULL THEN v_source := 'price_list'; ELSE v_unit := v_list; END IF;
    END IF;
    UPDATE public.cart_items SET
      list_price = v_list,
      unit_price = v_unit,
      line_total = v_unit * qty - discount_amount,
      price_source = v_source,
      price_list_item_id = v_pli_id
    WHERE id = r.id;
  END LOOP;
  PERFORM public.cart_recalculate(_cart_id);
END $$;

-- Cria reserva de estoque
CREATE OR REPLACE FUNCTION public.reserve_stock_for_cart_item(
  _cart_item_id uuid, _ttl_seconds int DEFAULT 1800
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_item public.cart_items%ROWTYPE;
  v_cart public.carts%ROWTYPE;
  v_res_id uuid;
BEGIN
  SELECT * INTO v_item FROM public.cart_items WHERE id = _cart_item_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cart item % not found', _cart_item_id; END IF;
  SELECT * INTO v_cart FROM public.carts WHERE id = v_item.cart_id;

  -- libera reservas anteriores deste item
  UPDATE public.stock_reservations
    SET status = 'released', released_at = now()
    WHERE cart_item_id = _cart_item_id AND status = 'active';

  INSERT INTO public.stock_reservations(store_id, cart_id, cart_item_id, variant_id, qty, expires_at)
  VALUES (v_cart.store_id, v_cart.id, v_item.id, v_item.variant_id, v_item.qty,
          now() + make_interval(secs => _ttl_seconds))
  RETURNING id INTO v_res_id;

  INSERT INTO public.stock_reservation_ledger(reservation_id, store_id, kind, qty, actor_user_id)
  VALUES (v_res_id, v_cart.store_id, 'reserve', v_item.qty, auth.uid());

  PERFORM public.record_cart_timeline_event(v_cart.id, 'reservation_created',
    jsonb_build_object('reservation_id', v_res_id, 'variant_id', v_item.variant_id, 'qty', v_item.qty));

  RETURN v_res_id;
END $$;

CREATE OR REPLACE FUNCTION public.release_stock_reservation(_reservation_id uuid, _reason text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_res public.stock_reservations%ROWTYPE;
BEGIN
  SELECT * INTO v_res FROM public.stock_reservations WHERE id = _reservation_id FOR UPDATE;
  IF NOT FOUND OR v_res.status <> 'active' THEN RETURN; END IF;
  UPDATE public.stock_reservations SET status='released', released_at=now() WHERE id = _reservation_id;
  INSERT INTO public.stock_reservation_ledger(reservation_id, store_id, kind, qty, actor_user_id, reason)
  VALUES (_reservation_id, v_res.store_id, 'release', v_res.qty, auth.uid(), _reason);
  IF v_res.cart_id IS NOT NULL THEN
    PERFORM public.record_cart_timeline_event(v_res.cart_id, 'reservation_released',
      jsonb_build_object('reservation_id', _reservation_id, 'reason', _reason));
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.expire_stale_cart_reservations()
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count int := 0; r record;
BEGIN
  FOR r IN SELECT id, store_id, qty, cart_id FROM public.stock_reservations
           WHERE status = 'active' AND expires_at < now() LIMIT 500 LOOP
    UPDATE public.stock_reservations SET status='expired', released_at=now() WHERE id = r.id;
    INSERT INTO public.stock_reservation_ledger(reservation_id, store_id, kind, qty, reason)
    VALUES (r.id, r.store_id, 'expire', r.qty, 'ttl');
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END $$;

-- Valida cupom
CREATE OR REPLACE FUNCTION public.validate_coupon(_coupon_id uuid, _cart_id uuid, _customer_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_coupon public.coupons%ROWTYPE;
  v_cart public.carts%ROWTYPE;
  v_used_total int;
  v_used_customer int;
BEGIN
  SELECT * INTO v_coupon FROM public.coupons WHERE id = _coupon_id;
  IF NOT FOUND OR NOT v_coupon.active THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'inactive');
  END IF;
  IF v_coupon.valid_from IS NOT NULL AND now() < v_coupon.valid_from THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'not_yet_valid');
  END IF;
  IF v_coupon.valid_until IS NOT NULL AND now() > v_coupon.valid_until THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'expired');
  END IF;
  SELECT * INTO v_cart FROM public.carts WHERE id = _cart_id;
  IF v_coupon.min_subtotal IS NOT NULL AND v_cart.subtotal < v_coupon.min_subtotal THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'min_subtotal_not_met');
  END IF;
  IF v_coupon.usage_limit_total IS NOT NULL AND v_coupon.usage_count >= v_coupon.usage_limit_total THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'limit_total_reached');
  END IF;
  IF _customer_id IS NOT NULL AND v_coupon.usage_limit_per_customer IS NOT NULL THEN
    SELECT count(*) INTO v_used_customer FROM public.coupon_redemptions
    WHERE coupon_id = _coupon_id AND customer_id = _customer_id;
    IF v_used_customer >= v_coupon.usage_limit_per_customer THEN
      RETURN jsonb_build_object('valid', false, 'reason', 'limit_customer_reached');
    END IF;
  END IF;
  RETURN jsonb_build_object('valid', true, 'coupon_id', _coupon_id, 'type', v_coupon.type, 'value', v_coupon.value);
END $$;

CREATE OR REPLACE FUNCTION public.apply_coupon_to_cart(_coupon_code text, _cart_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_cart public.carts%ROWTYPE;
  v_coupon public.coupons%ROWTYPE;
  v_validation jsonb;
  v_amount numeric(14,2) := 0;
  v_cc_id uuid;
BEGIN
  SELECT * INTO v_cart FROM public.carts WHERE id = _cart_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cart not found'; END IF;
  SELECT * INTO v_coupon FROM public.coupons
    WHERE store_id = v_cart.store_id AND lower(code) = lower(_coupon_code);
  IF NOT FOUND THEN
    INSERT INTO public.coupon_ledger(coupon_code, store_id, cart_id, customer_id, kind, reason)
    VALUES (_coupon_code, v_cart.store_id, _cart_id, v_cart.customer_id, 'rejected', 'not_found');
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  v_validation := public.validate_coupon(v_coupon.id, _cart_id, v_cart.customer_id);
  IF NOT (v_validation->>'valid')::boolean THEN
    INSERT INTO public.coupon_ledger(coupon_id, coupon_code, store_id, cart_id, customer_id, kind, reason)
    VALUES (v_coupon.id, v_coupon.code, v_cart.store_id, _cart_id, v_cart.customer_id, 'rejected', v_validation->>'reason');
    RETURN jsonb_build_object('ok', false, 'reason', v_validation->>'reason');
  END IF;

  IF v_coupon.type = 'percent' THEN
    v_amount := round(v_cart.subtotal * v_coupon.value / 100.0, 2);
    IF v_coupon.max_discount IS NOT NULL THEN v_amount := LEAST(v_amount, v_coupon.max_discount); END IF;
  ELSIF v_coupon.type = 'fixed' THEN
    v_amount := LEAST(v_coupon.value, v_cart.subtotal);
  ELSE
    v_amount := 0;
  END IF;

  INSERT INTO public.cart_coupons(cart_id, coupon_id, applied_value, snapshot)
  VALUES (_cart_id, v_coupon.id, v_amount, to_jsonb(v_coupon))
  ON CONFLICT (cart_id, coupon_id) DO UPDATE SET applied_value = excluded.applied_value
  RETURNING id INTO v_cc_id;

  INSERT INTO public.coupon_ledger(coupon_id, coupon_code, store_id, cart_id, customer_id, kind, amount)
  VALUES (v_coupon.id, v_coupon.code, v_cart.store_id, _cart_id, v_cart.customer_id, 'applied', v_amount);

  PERFORM public.record_cart_timeline_event(_cart_id, 'coupon_applied',
    jsonb_build_object('coupon_code', v_coupon.code, 'amount', v_amount));

  PERFORM public.cart_recalculate(_cart_id);
  RETURN jsonb_build_object('ok', true, 'amount', v_amount, 'cart_coupon_id', v_cc_id);
END $$;

CREATE OR REPLACE FUNCTION public.remove_coupon_from_cart(_cart_coupon_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_cc public.cart_coupons%ROWTYPE; v_cart public.carts%ROWTYPE;
BEGIN
  SELECT * INTO v_cc FROM public.cart_coupons WHERE id = _cart_coupon_id;
  IF NOT FOUND THEN RETURN; END IF;
  SELECT * INTO v_cart FROM public.carts WHERE id = v_cc.cart_id;
  DELETE FROM public.cart_coupons WHERE id = _cart_coupon_id;
  INSERT INTO public.coupon_ledger(coupon_id, store_id, cart_id, customer_id, kind)
  VALUES (v_cc.coupon_id, v_cart.store_id, v_cc.cart_id, v_cart.customer_id, 'removed');
  PERFORM public.record_cart_timeline_event(v_cc.cart_id, 'coupon_removed',
    jsonb_build_object('coupon_id', v_cc.coupon_id));
  PERFORM public.cart_recalculate(v_cc.cart_id);
END $$;

-- Merge carrinho anônimo -> autenticado
CREATE OR REPLACE FUNCTION public.merge_anonymous_cart(_anonymous_cart_id uuid, _customer_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_anon public.carts%ROWTYPE;
  v_target public.carts%ROWTYPE;
  v_target_id uuid;
  r record;
BEGIN
  SELECT * INTO v_anon FROM public.carts WHERE id = _anonymous_cart_id FOR UPDATE;
  IF NOT FOUND OR v_anon.status <> 'active' THEN RAISE EXCEPTION 'Anonymous cart invalid'; END IF;

  SELECT * INTO v_target FROM public.carts
    WHERE store_id = v_anon.store_id AND customer_id = _customer_id AND status = 'active'
    LIMIT 1;

  IF NOT FOUND THEN
    UPDATE public.carts SET customer_id = _customer_id, session_token = NULL WHERE id = _anonymous_cart_id
    RETURNING id INTO v_target_id;
    PERFORM public.record_cart_timeline_event(v_target_id, 'merged',
      jsonb_build_object('mode','adopt','customer_id',_customer_id));
    PERFORM public.cart_apply_pricing(v_target_id);
    RETURN v_target_id;
  END IF;

  v_target_id := v_target.id;

  FOR r IN SELECT * FROM public.cart_items WHERE cart_id = _anonymous_cart_id LOOP
    INSERT INTO public.cart_items(cart_id, variant_id, product_id, qty, list_price, unit_price, line_total, snapshot)
    VALUES (v_target_id, r.variant_id, r.product_id, r.qty, r.list_price, r.unit_price, r.line_total, r.snapshot)
    ON CONFLICT (cart_id, variant_id) DO UPDATE SET
      qty = cart_items.qty + excluded.qty,
      line_total = (cart_items.qty + excluded.qty) * cart_items.unit_price - cart_items.discount_amount;
  END LOOP;

  UPDATE public.carts SET status='merged', merged_into_cart_id = v_target_id WHERE id = _anonymous_cart_id;

  PERFORM public.record_cart_timeline_event(v_target_id, 'merged',
    jsonb_build_object('mode','combine','source_cart_id',_anonymous_cart_id));
  PERFORM public.record_cart_timeline_event(_anonymous_cart_id, 'merged',
    jsonb_build_object('target_cart_id', v_target_id));
  PERFORM public.cart_apply_pricing(v_target_id);
  RETURN v_target_id;
END $$;

-- Feature flags
INSERT INTO public.feature_flags(key, name, description, enabled, default_value)
VALUES
  ('cart.enable_anonymous','Carrinho Anônimo','Permite carrinhos sem login', true, 'true'::jsonb),
  ('cart.reservation_ttl_seconds','TTL Reserva de Estoque','TTL em segundos da reserva', true, '1800'::jsonb),
  ('shipping.enable_quotes_cache','Cache de Cotações','Cacheia cotações de frete', true, 'true'::jsonb),
  ('coupon.enable_stacking','Empilhamento de Cupons','Permite múltiplos cupons no carrinho', true, 'false'::jsonb)
ON CONFLICT (key) DO NOTHING;
