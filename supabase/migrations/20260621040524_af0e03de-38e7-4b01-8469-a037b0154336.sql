
-- =====================================================================
-- CUSTOMER EXPERIENCE — MIGRATION 1/4
-- =====================================================================

CREATE TYPE public.review_status AS ENUM ('pending','approved','rejected','flagged','removed');
CREATE TYPE public.notification_channel AS ENUM ('email','in_app','whatsapp','push','sms');
CREATE TYPE public.portal_session_status AS ENUM ('active','ended','revoked');

CREATE OR REPLACE FUNCTION public._is_customer_owner(p_customer_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.customers c
     WHERE c.id = p_customer_id AND c.auth_user_id = auth.uid()
  );
$$;
GRANT EXECUTE ON FUNCTION public._is_customer_owner(uuid) TO authenticated, anon;

INSERT INTO public.permissions (code, module, description) VALUES
  ('portal.manage_wishlist', 'portal', 'Create and edit own wishlists'),
  ('portal.create_review',   'portal', 'Submit product reviews'),
  ('portal.vote_review',     'portal', 'Vote helpful/unhelpful on reviews'),
  ('cx.moderate_reviews',    'cx',     'Approve/reject product reviews')
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.roles (code, name, description) VALUES
  ('cx_manager', 'CX Manager', 'Customer Experience / SAC manager')
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r CROSS JOIN public.permissions p
 WHERE (r.code='cx_manager' AND p.code IN ('cx.moderate_reviews','portal.create_review','portal.vote_review','portal.manage_wishlist'))
    OR (r.code='super_admin' AND p.code IN ('cx.moderate_reviews','portal.create_review','portal.vote_review','portal.manage_wishlist'))
    OR (r.code='store_admin' AND p.code IN ('cx.moderate_reviews','portal.create_review','portal.vote_review','portal.manage_wishlist'))
ON CONFLICT DO NOTHING;

-- customer_portal_sessions ---------------------------------------------
CREATE TABLE public.customer_portal_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  status public.portal_session_status NOT NULL DEFAULT 'active',
  device_fingerprint text,
  ip_address inet,
  user_agent text,
  started_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_cps_customer ON public.customer_portal_sessions(customer_id, started_at DESC);
CREATE INDEX idx_cps_active ON public.customer_portal_sessions(customer_id) WHERE status = 'active';
GRANT SELECT, INSERT, UPDATE ON public.customer_portal_sessions TO authenticated;
GRANT ALL ON public.customer_portal_sessions TO service_role;
ALTER TABLE public.customer_portal_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cps_owner_select" ON public.customer_portal_sessions FOR SELECT TO authenticated
  USING (public._is_customer_owner(customer_id) OR public.is_super_admin(auth.uid()));
CREATE POLICY "cps_owner_insert" ON public.customer_portal_sessions FOR INSERT TO authenticated
  WITH CHECK (public._is_customer_owner(customer_id));
CREATE POLICY "cps_owner_update" ON public.customer_portal_sessions FOR UPDATE TO authenticated
  USING (public._is_customer_owner(customer_id)) WITH CHECK (public._is_customer_owner(customer_id));

-- customer_notification_preferences ------------------------------------
CREATE TABLE public.customer_notification_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  channel public.notification_channel NOT NULL,
  event_type text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(customer_id, channel, event_type)
);
CREATE INDEX idx_cnp_customer ON public.customer_notification_preferences(customer_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_notification_preferences TO authenticated;
GRANT ALL ON public.customer_notification_preferences TO service_role;
ALTER TABLE public.customer_notification_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cnp_owner_all" ON public.customer_notification_preferences FOR ALL TO authenticated
  USING (public._is_customer_owner(customer_id) OR public.is_super_admin(auth.uid()))
  WITH CHECK (public._is_customer_owner(customer_id));
CREATE TRIGGER trg_cnp_updated BEFORE UPDATE ON public.customer_notification_preferences
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- wishlists ------------------------------------------------------------
CREATE TABLE public.wishlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'My Wishlist',
  is_default boolean NOT NULL DEFAULT false,
  is_public boolean NOT NULL DEFAULT false,
  share_token uuid UNIQUE,
  items_count integer NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_wishlists_customer ON public.wishlists(customer_id);
CREATE UNIQUE INDEX idx_wishlists_one_default ON public.wishlists(customer_id) WHERE is_default = true;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wishlists TO authenticated;
GRANT SELECT ON public.wishlists TO anon;
GRANT ALL ON public.wishlists TO service_role;
ALTER TABLE public.wishlists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wishlists_owner_all" ON public.wishlists FOR ALL TO authenticated
  USING (public._is_customer_owner(customer_id) OR public.is_super_admin(auth.uid()))
  WITH CHECK (public._is_customer_owner(customer_id));
CREATE POLICY "wishlists_public_select" ON public.wishlists FOR SELECT TO authenticated, anon
  USING (is_public = true);
CREATE TRIGGER trg_wishlists_updated BEFORE UPDATE ON public.wishlists
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.wishlists_share_token_autogen()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.is_public = true AND NEW.share_token IS NULL THEN
    NEW.share_token := gen_random_uuid();
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_wishlists_share_token
  BEFORE INSERT OR UPDATE OF is_public ON public.wishlists
  FOR EACH ROW EXECUTE FUNCTION public.wishlists_share_token_autogen();

-- wishlist_items -------------------------------------------------------
CREATE TABLE public.wishlist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wishlist_id uuid NOT NULL REFERENCES public.wishlists(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  variant_id uuid REFERENCES public.product_variants(id) ON DELETE CASCADE,
  notes text,
  sort_order integer NOT NULL DEFAULT 0,
  added_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(wishlist_id, product_id, variant_id)
);
CREATE INDEX idx_wishlist_items_wishlist ON public.wishlist_items(wishlist_id, sort_order);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wishlist_items TO authenticated;
GRANT SELECT ON public.wishlist_items TO anon;
GRANT ALL ON public.wishlist_items TO service_role;
ALTER TABLE public.wishlist_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wli_owner_all" ON public.wishlist_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.wishlists w WHERE w.id = wishlist_id
                  AND (public._is_customer_owner(w.customer_id) OR public.is_super_admin(auth.uid()))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.wishlists w WHERE w.id = wishlist_id
                  AND public._is_customer_owner(w.customer_id)));
CREATE POLICY "wli_public_select" ON public.wishlist_items FOR SELECT TO authenticated, anon
  USING (EXISTS (SELECT 1 FROM public.wishlists w WHERE w.id = wishlist_id AND w.is_public = true));

CREATE OR REPLACE FUNCTION public.wishlists_items_count_sync()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_wishlist uuid; v_delta integer;
BEGIN
  IF TG_OP = 'INSERT' THEN v_wishlist := NEW.wishlist_id; v_delta := 1;
  ELSIF TG_OP = 'DELETE' THEN v_wishlist := OLD.wishlist_id; v_delta := -1;
  ELSE RETURN NEW; END IF;
  UPDATE public.wishlists SET items_count = GREATEST(0, items_count + v_delta) WHERE id = v_wishlist;
  RETURN COALESCE(NEW, OLD);
END $$;
CREATE TRIGGER trg_wli_count_sync
  AFTER INSERT OR DELETE ON public.wishlist_items
  FOR EACH ROW EXECUTE FUNCTION public.wishlists_items_count_sync();

-- product_reviews ------------------------------------------------------
CREATE TABLE public.product_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  variant_id uuid REFERENCES public.product_variants(id) ON DELETE SET NULL,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  order_item_id uuid REFERENCES public.order_items(id) ON DELETE SET NULL,
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title text,
  body text,
  status public.review_status NOT NULL DEFAULT 'pending',
  verified_purchase boolean NOT NULL DEFAULT false,
  helpful_count integer NOT NULL DEFAULT 0,
  unhelpful_count integer NOT NULL DEFAULT 0,
  language text NOT NULL DEFAULT 'pt-BR',
  moderated_by uuid REFERENCES auth.users(id),
  moderated_at timestamptz,
  moderation_notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(product_id, customer_id, order_item_id)
);
CREATE INDEX idx_reviews_product_status ON public.product_reviews(product_id, status, created_at DESC);
CREATE INDEX idx_reviews_customer ON public.product_reviews(customer_id, created_at DESC);
CREATE INDEX idx_reviews_pending ON public.product_reviews(store_id, created_at DESC) WHERE status = 'pending';
GRANT SELECT, INSERT, UPDATE ON public.product_reviews TO authenticated;
GRANT SELECT ON public.product_reviews TO anon;
GRANT ALL ON public.product_reviews TO service_role;
ALTER TABLE public.product_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reviews_public_approved" ON public.product_reviews FOR SELECT TO authenticated, anon
  USING (status = 'approved');
CREATE POLICY "reviews_owner_select" ON public.product_reviews FOR SELECT TO authenticated
  USING (public._is_customer_owner(customer_id));
CREATE POLICY "reviews_owner_insert" ON public.product_reviews FOR INSERT TO authenticated
  WITH CHECK (public._is_customer_owner(customer_id) AND status = 'pending');
CREATE POLICY "reviews_owner_update_own_pending" ON public.product_reviews FOR UPDATE TO authenticated
  USING (public._is_customer_owner(customer_id) AND status = 'pending')
  WITH CHECK (public._is_customer_owner(customer_id) AND status = 'pending');
CREATE POLICY "reviews_moderator_all" ON public.product_reviews FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(),'cx.moderate_reviews',store_id))
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(),'cx.moderate_reviews',store_id));
CREATE TRIGGER trg_reviews_updated BEFORE UPDATE ON public.product_reviews
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.product_reviews_verified_purchase_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_ok boolean := false;
BEGIN
  IF NEW.order_item_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.order_items oi
       JOIN public.orders o ON o.id = oi.order_id
       WHERE oi.id = NEW.order_item_id
         AND oi.product_id = NEW.product_id
         AND o.customer_id = NEW.customer_id
    ) INTO v_ok;
  END IF;
  NEW.verified_purchase := v_ok;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_reviews_verified
  BEFORE INSERT OR UPDATE OF order_item_id ON public.product_reviews
  FOR EACH ROW EXECUTE FUNCTION public.product_reviews_verified_purchase_guard();

-- product_review_media -------------------------------------------------
CREATE TABLE public.product_review_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL REFERENCES public.product_reviews(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  asset_id uuid NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_review_media_review ON public.product_review_media(review_id, sort_order);
GRANT SELECT, INSERT, DELETE ON public.product_review_media TO authenticated;
GRANT SELECT ON public.product_review_media TO anon;
GRANT ALL ON public.product_review_media TO service_role;
ALTER TABLE public.product_review_media ENABLE ROW LEVEL SECURITY;
CREATE POLICY "review_media_public" ON public.product_review_media FOR SELECT TO authenticated, anon
  USING (EXISTS (SELECT 1 FROM public.product_reviews r WHERE r.id = review_id AND r.status = 'approved'));
CREATE POLICY "review_media_owner_all" ON public.product_review_media FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.product_reviews r WHERE r.id = review_id AND public._is_customer_owner(r.customer_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.product_reviews r WHERE r.id = review_id AND public._is_customer_owner(r.customer_id)));
CREATE POLICY "review_media_moderator" ON public.product_review_media FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(),'cx.moderate_reviews',store_id))
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(),'cx.moderate_reviews',store_id));

-- product_review_helpful_votes -----------------------------------------
CREATE TABLE public.product_review_helpful_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL REFERENCES public.product_reviews(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  vote smallint NOT NULL CHECK (vote IN (-1, 1)),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(review_id, customer_id)
);
CREATE INDEX idx_review_votes_review ON public.product_review_helpful_votes(review_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_review_helpful_votes TO authenticated;
GRANT ALL ON public.product_review_helpful_votes TO service_role;
ALTER TABLE public.product_review_helpful_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "review_votes_owner_all" ON public.product_review_helpful_votes FOR ALL TO authenticated
  USING (public._is_customer_owner(customer_id) OR public.is_super_admin(auth.uid()))
  WITH CHECK (public._is_customer_owner(customer_id));
CREATE POLICY "review_votes_public_select" ON public.product_review_helpful_votes FOR SELECT TO authenticated, anon
  USING (EXISTS (SELECT 1 FROM public.product_reviews r WHERE r.id = review_id AND r.status='approved'));

CREATE OR REPLACE FUNCTION public.product_reviews_helpful_sync()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.vote = 1 THEN
      UPDATE public.product_reviews SET helpful_count = helpful_count + 1 WHERE id = NEW.review_id;
    ELSE
      UPDATE public.product_reviews SET unhelpful_count = unhelpful_count + 1 WHERE id = NEW.review_id;
    END IF;
  ELSIF TG_OP = 'UPDATE' AND NEW.vote <> OLD.vote THEN
    UPDATE public.product_reviews SET
      helpful_count   = helpful_count   + CASE WHEN NEW.vote =  1 THEN 1 ELSE -1 END,
      unhelpful_count = unhelpful_count + CASE WHEN NEW.vote = -1 THEN 1 ELSE -1 END
     WHERE id = NEW.review_id;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.vote = 1 THEN
      UPDATE public.product_reviews SET helpful_count = GREATEST(0, helpful_count - 1) WHERE id = OLD.review_id;
    ELSE
      UPDATE public.product_reviews SET unhelpful_count = GREATEST(0, unhelpful_count - 1) WHERE id = OLD.review_id;
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;
CREATE TRIGGER trg_review_votes_sync
  AFTER INSERT OR UPDATE OR DELETE ON public.product_review_helpful_votes
  FOR EACH ROW EXECUTE FUNCTION public.product_reviews_helpful_sync();
